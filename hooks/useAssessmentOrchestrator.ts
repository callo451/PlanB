
import { useState, useRef, useEffect, useCallback, RefObject } from 'react';
import type { AppEvent, OcrPayload, Fingerprint, ItemState, Vote, LlmAnswer } from '../types';
import { ItemStatus } from '../types';
import { askModel } from '../services/geminiService';
import { MOCK_ASSESSMENT_ITEMS } from '../utils/mockData';
import { generateFingerprint } from '../utils/crypto';

const STABILITY_WINDOW_SIZE = 5;
const STABILITY_VOTE_THRESHOLD = 4;
const STABILITY_CONFIDENCE_THRESHOLD = 0.7;
const STABILITY_TIME_MS = 600;

interface UseAssessmentOrchestratorProps {
  videoRef: RefObject<HTMLVideoElement>;
}

export const useAssessmentOrchestrator = ({ videoRef }: UseAssessmentOrchestratorProps) => {
  const [event, setEvent] = useState<AppEvent>({ type: 'status', status: 'idle' });
  const [isCapturing, setIsCapturing] = useState(false);
  
  const stateMapRef = useRef<Map<string, ItemState>>(new Map());
  const currentFingerprintIdRef = useRef<string | null>(null);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const emit = useCallback((newEvent: AppEvent) => {
    setEvent(newEvent);
  }, []);

  const handleOcr = useCallback(async (payload: OcrPayload) => {
    const fingerprint = await generateFingerprint(payload.stem, payload.options);

    if (currentFingerprintIdRef.current !== fingerprint.id) {
      // New question detected, reset state
      const oldState = currentFingerprintIdRef.current ? stateMapRef.current.get(currentFingerprintIdRef.current) : undefined;
      oldState?.abortController?.abort();

      currentFingerprintIdRef.current = fingerprint.id;
      if (!stateMapRef.current.has(fingerprint.id)) {
        stateMapRef.current.set(fingerprint.id, {
          fingerprint,
          votes: [],
          status: ItemStatus.IDLE,
          isAsking: false,
        });
        emit({ type: 'status', status: 'reading' });
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
      const llmAnswer = await askModel(payload, state.abortController.signal);
      const vote: Vote = { ...llmAnswer, ts: Date.now() };
      state.votes.push(vote);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error("Error asking model:", error);
      }
    } finally {
        if(stateMapRef.current.has(fingerprint.id)) {
            const currentState = stateMapRef.current.get(fingerprint.id);
            if(currentState) currentState.isAsking = false;
        }
    }
  }, [emit]);

  const tick = useCallback(() => {
    if (!currentFingerprintIdRef.current) return;
    const state = stateMapRef.current.get(currentFingerprintIdRef.current);
    if (!state || state.status !== ItemStatus.READING) return;

    const recentVotes = state.votes.slice(-STABILITY_WINDOW_SIZE);
    if (recentVotes.length < STABILITY_WINDOW_SIZE) return;
    
    const firstVoteTime = recentVotes[0].ts;
    if (Date.now() - firstVoteTime < STABILITY_TIME_MS) return;

    const voteCounts = new Map<string, { count: number; votes: Vote[] }>();
    recentVotes.forEach(vote => {
      const existing = voteCounts.get(vote.answerId) || { count: 0, votes: [] };
      existing.count++;
      existing.votes.push(vote);
      voteCounts.set(vote.answerId, existing);
    });

    const [winningAnswerId, data] = [...voteCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0] || [];

    if (winningAnswerId && data && data.count >= STABILITY_VOTE_THRESHOLD) {
      const avgConfidence = data.votes.reduce((acc, v) => acc + v.confidence, 0) / data.votes.length;
      if (avgConfidence >= STABILITY_CONFIDENCE_THRESHOLD) {
        state.status = ItemStatus.FINALIZED;
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        let mockIndex = 0;
        let frameCount = 0;
        
        captureIntervalRef.current = setInterval(() => {
          // Change question every ~5 seconds (2fps * 5s = 10 frames)
          if(frameCount % 10 === 0 && frameCount > 0){
            mockIndex = (mockIndex + 1) % MOCK_ASSESSMENT_ITEMS.length;
            // When question changes, immediately reset UI to reading
            emit({ type: 'status', status: 'reading' });
          }
          handleOcr(MOCK_ASSESSMENT_ITEMS[mockIndex]);
          frameCount++;
        }, 500); // ~2 fps

        tickIntervalRef.current = setInterval(tick, 250);
        setIsCapturing(true);
        emit({type: 'status', status: 'reading'});

      } catch (err) {
        console.error("Error accessing camera:", err);
        setIsCapturing(false);
        emit({ type: 'status', status: 'idle' });
      }
  }, [isCapturing, videoRef, emit, handleOcr, tick]);

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
    };
  }, [stopCapture]);

  return { event, isCapturing, toggleCapture };
};