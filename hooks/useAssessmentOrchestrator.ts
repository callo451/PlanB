
import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import type { AppEvent, OcrPayload, Fingerprint, ItemState, Vote, LlmAnswer } from '../types';
import { ItemStatus } from '../types';
import { analyzeImageForAssessment } from '../services/geminiService';
import { ImageCapture } from '../utils/imageCapture';
import { generateFingerprint } from '../utils/crypto';

const STABILITY_WINDOW_SIZE = 3;
const STABILITY_VOTE_THRESHOLD = 2;
const STABILITY_CONFIDENCE_THRESHOLD = 0.7;
const STABILITY_TIME_MS = 15000; // Allow 15 seconds for stability window
const HIGH_CONFIDENCE_THRESHOLD = 0.85; // For immediate finalization

interface UseAssessmentOrchestratorProps {
  videoRef: RefObject<HTMLVideoElement>;
  selectedDeviceId?: string | null;
}

export const useAssessmentOrchestrator = ({ videoRef, selectedDeviceId }: UseAssessmentOrchestratorProps) => {
  const [event, setEvent] = useState<AppEvent>({ type: 'status', status: 'idle' });
  const [isCapturing, setIsCapturing] = useState(false);
  
  const stateMapRef = useRef<Map<string, ItemState>>(new Map());
  const currentFingerprintIdRef = useRef<string | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFinalizedTimeRef = useRef<number>(0);
  const lastAnalysisTimeRef = useRef<number>(0);
  const imageCaptureRef = useRef<ImageCapture>(new ImageCapture());

  const emit = useCallback((newEvent: AppEvent) => {
    setEvent(newEvent);
    
    // Broadcast to teleprompter via localStorage
    try {
      localStorage.setItem('assessment-event', JSON.stringify(newEvent));
      localStorage.setItem('assessment-event-timestamp', new Date().toISOString());
    } catch (error) {
      console.error('Error broadcasting to teleprompter:', error);
    }
  }, []);

  const analyzeCurrentFrame = useCallback(async () => {
    if (!videoRef.current) {
      console.log("Skipping analysis: video not ready");
      return;
    }

    try {
      const now = Date.now();
      
      // Rate limiting: don't analyze more than once every 8 seconds
      if (now - lastAnalysisTimeRef.current < 8000) {
        console.log("Skipping analysis due to rate limiting");
        return;
      }
      
      lastAnalysisTimeRef.current = now;
      console.log("Starting frame analysis...");
      
      // Capture current frame from video
      const capturedImage = imageCaptureRef.current.enhanceImageForOCR(videoRef.current);
      if (!capturedImage) {
        console.warn("Could not capture image from video");
        return;
      }

      console.log("Image captured successfully, size:", capturedImage.width, "x", capturedImage.height);

      // Analyze image with Gemini Vision
      const abortController = new AbortController();
      console.log("Sending image to Gemini Vision API...");
      const analysisResult = await analyzeImageForAssessment(capturedImage, abortController.signal);
      
      console.log("Vision analysis result:", analysisResult);

      // Skip if no question detected
      if (analysisResult.answerId === 'NO_QUESTION' || analysisResult.confidence < 0.3) {
        console.log("No question detected or low confidence:", analysisResult.answerId, "confidence:", analysisResult.confidence);
        return;
      }

      // Create fingerprint from detected question
      const questionText = analysisResult.questionText || "Unknown question";
      const options = analysisResult.options || [];
      
      console.log("Creating fingerprint for question:", questionText);
      console.log("Question options:", options);
      console.log("Answer detected:", analysisResult.answerId);
      
      const fingerprint = await generateFingerprint(questionText, options);

      if (currentFingerprintIdRef.current !== fingerprint.id) {
        // New question detected, reset state
        const oldState = currentFingerprintIdRef.current ? stateMapRef.current.get(currentFingerprintIdRef.current) : undefined;
        oldState?.abortController?.abort();
        
        console.log("New question detected! Old fingerprint:", currentFingerprintIdRef.current, "New fingerprint:", fingerprint.id);

        currentFingerprintIdRef.current = fingerprint.id;
        if (!stateMapRef.current.has(fingerprint.id)) {
          stateMapRef.current.set(fingerprint.id, {
            fingerprint,
            votes: [],
            status: ItemStatus.IDLE,
            isAsking: false,
          });
          console.log("Emitting 'reading' status for new question");
          emit({ type: 'status', status: 'reading' });
        } else {
          // Question already exists, check if it was finalized
          const existingState = stateMapRef.current.get(fingerprint.id);
          if (existingState && existingState.status === ItemStatus.FINALIZED) {
            console.log("Question already finalized, re-emitting finalized event");
            emit({
              type: 'finalized',
              answerId: existingState.best!.answerId,
              confidence: existingState.best!.confidence,
              instruction: existingState.best!.instruction,
              fingerprintId: fingerprint.id,
            });
          }
        }
      }

      const state = stateMapRef.current.get(fingerprint.id);
      if (!state || state.status === ItemStatus.FINALIZED || state.isAsking) {
        return;
      }

      state.status = ItemStatus.READING;
      state.isAsking = true;
      state.abortController = new AbortController();

      try {
        // Validate analysis result before adding vote
        if (!analysisResult.answerId || typeof analysisResult.confidence !== 'number') {
          console.warn("Invalid analysis result:", analysisResult);
          return;
        }
        
        const vote: Vote = { ...analysisResult, ts: Date.now() };
        state.votes.push(vote);
        console.log("Added vision analysis vote:", vote);
        
        // Check for immediate finalization on high-confidence answers
        if (analysisResult.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
          console.log("High confidence answer detected, finalizing immediately:", analysisResult.confidence);
          state.status = ItemStatus.FINALIZED;
          lastFinalizedTimeRef.current = Date.now();
          state.best = {
            answerId: vote.answerId,
            confidence: vote.confidence,
            instruction: vote.instruction,
          };
          emit({
            type: 'finalized',
            answerId: state.best.answerId,
            confidence: state.best.confidence,
            instruction: state.best.instruction,
            fingerprintId: state.fingerprint.id,
          });
          console.log("Immediately finalized high-confidence answer:", state.best);
          return;
        }
        
        // Emit status update to show we're making progress
        emit({ type: 'status', status: 'proposing' });
      } catch (error) {
        if (state.abortController?.signal.aborted) {
          // Request was intentionally cancelled, don't log as error
          return;
        }
        console.error("Error processing vision analysis:", error);
      } finally {
        if(stateMapRef.current.has(fingerprint.id)) {
          const currentState = stateMapRef.current.get(fingerprint.id);
          if(currentState) currentState.isAsking = false;
        }
      }
    } catch (error) {
      console.error("Error in frame analysis:", error);
    }
  }, [videoRef, emit]);

  const tick = useCallback(() => {
    if (!currentFingerprintIdRef.current) return;
    const state = stateMapRef.current.get(currentFingerprintIdRef.current);
    if (!state || state.status !== ItemStatus.READING) return;

    const recentVotes = state.votes.slice(-STABILITY_WINDOW_SIZE);
    console.log(`Stability check: ${recentVotes.length}/${STABILITY_WINDOW_SIZE} votes needed, current votes:`, recentVotes.map(v => ({ answerId: v.answerId, confidence: v.confidence })));
    
    // For very recent votes, require the full window
    if (recentVotes.length < STABILITY_WINDOW_SIZE) {
      // But if we have at least 1 vote and it's been a while, consider it stable
      if (recentVotes.length >= 1 && (Date.now() - recentVotes[0].ts) > 20000) {
        console.log("Single vote stability timeout reached, proceeding with available votes");
      } else {
        return;
      }
    } else {
      const firstVoteTime = recentVotes[0].ts;
      if (Date.now() - firstVoteTime < STABILITY_TIME_MS) return;
    }

    const voteCounts = new Map<string, { count: number; votes: Vote[] }>();
    recentVotes.forEach(vote => {
      const existing = voteCounts.get(vote.answerId) || { count: 0, votes: [] };
      existing.count++;
      existing.votes.push(vote);
      voteCounts.set(vote.answerId, existing);
    });

    const [winningAnswerId, data] = [...voteCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0] || [];

    if (winningAnswerId && data) {
      const avgConfidence = data.votes.reduce((acc, v) => acc + v.confidence, 0) / data.votes.length;
      
      // Lower threshold for stability when we have fewer votes but good confidence
      const requiredCount = recentVotes.length < STABILITY_WINDOW_SIZE ? 1 : STABILITY_VOTE_THRESHOLD;
      
      if (data.count >= requiredCount && avgConfidence >= STABILITY_CONFIDENCE_THRESHOLD) {
        state.status = ItemStatus.FINALIZED;
        lastFinalizedTimeRef.current = Date.now();
        const bestVote = data.votes.sort((a, b) => b.confidence - a.confidence)[0];
        state.best = {
          answerId: bestVote.answerId,
          confidence: avgConfidence,
          instruction: bestVote.instruction,
        };
        emit({
          type: 'finalized',
          answerId: state.best.answerId,
          confidence: state.best.confidence,
          instruction: state.best.instruction,
          fingerprintId: state.fingerprint.id,
        });
        console.log("Finalized Answer:", state.best, "Full Log:", state);
      }
    }
  }, [emit]);
  
  const startCapture = useCallback(async () => {
      if (isCapturing || !videoRef.current) {
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Wait for video to be ready before starting analysis
        const waitForVideo = () => {
          if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            console.log("Video ready! Dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
            // Start vision analysis at regular intervals
            captureIntervalRef.current = setInterval(async () => {
              try {
                await analyzeCurrentFrame();
              } catch (error) {
                console.error("Error in vision analysis interval:", error);
              }
            }, 10000); // Analyze every 10 seconds to avoid rate limits
          } else {
            console.log("Waiting for video to be ready...");
            setTimeout(waitForVideo, 1000);
          }
        };
        
        // Start checking for video readiness
        setTimeout(waitForVideo, 1000);

        tickIntervalRef.current = setInterval(tick, 250);
        setIsCapturing(true);
        emit({type: 'status', status: 'reading'});

      } catch (err) {
        console.error("Error accessing camera:", err);
        setIsCapturing(false);
        emit({ type: 'status', status: 'idle' });
      }
  }, [isCapturing, videoRef, selectedDeviceId, emit, analyzeCurrentFrame, tick]);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    const oldState = currentFingerprintIdRef.current ? stateMapRef.current.get(currentFingerprintIdRef.current) : undefined;
    oldState?.abortController?.abort();
    
    captureIntervalRef.current = null;
    tickIntervalRef.current = null;
    currentFingerprintIdRef.current = null;
    stateMapRef.current.clear();
    setIsCapturing(false);
    emit({type: 'status', status: 'idle'});
  }, [emit, videoRef]);

  const toggleCapture = useCallback(() => {
    if (isCapturing) {
      stopCapture();
    } else {
      startCapture();
    }
  }, [isCapturing, startCapture, stopCapture]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopCapture();
      imageCaptureRef.current.cleanup();
    };
  }, [stopCapture]);

  return { event, isCapturing, toggleCapture };
};