import React, { useState, useEffect } from 'react';
import type { AppEvent } from '../types';

export const Teleprompter: React.FC = () => {
  const [event, setEvent] = useState<AppEvent>({ type: 'status', status: 'idle' });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkForUpdates = () => {
      try {
        const storedEvent = localStorage.getItem('assessment-event');
        const storedTimestamp = localStorage.getItem('assessment-event-timestamp');
        
        if (storedEvent && storedTimestamp) {
          const timestamp = new Date(storedTimestamp);
          const eventData = JSON.parse(storedEvent);
          
          // Check if this is a new update
          if (!lastUpdate || timestamp > lastUpdate) {
            setEvent(eventData);
            setLastUpdate(timestamp);
            setIsConnected(true);
          }
        }
      } catch (error) {
        console.error('Error reading assessment event:', error);
        setIsConnected(false);
      }
    };

    // Check immediately
    checkForUpdates();
    
    // Poll for updates every 500ms
    const interval = setInterval(checkForUpdates, 500);
    
    // Check connection status
    const connectionCheck = setInterval(() => {
      const storedTimestamp = localStorage.getItem('assessment-event-timestamp');
      if (storedTimestamp) {
        const timestamp = new Date(storedTimestamp);
        const now = new Date();
        // Consider disconnected if no updates for 3 seconds
        setIsConnected(now.getTime() - timestamp.getTime() < 3000);
      } else {
        setIsConnected(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(connectionCheck);
    };
  }, [lastUpdate]);

  const renderStatus = (status: string) => {
    switch (status) {
      case 'idle':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">⏸️</div>
            <div className="text-2xl font-medium text-gray-400">
              Waiting for assessment to start...
            </div>
          </div>
        );
      case 'reading':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">👁️</div>
            <div className="text-2xl font-medium text-blue-400">
              Reading question...
            </div>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        );
      case 'proposing':
        return (
          <div className="text-center space-y-4">
            <div className="text-6xl">🤔</div>
            <div className="text-2xl font-medium text-yellow-400">
              Analyzing options...
            </div>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center">
            <div className="text-2xl text-gray-400">Unknown status</div>
          </div>
        );
    }
  };

  const renderFinalizedAnswer = () => {
    if (event.type !== 'finalized') return null;
    
    const confidencePercentage = (event.confidence * 100).toFixed(0);
    const confidenceColor = event.confidence >= 0.8 ? 'text-green-400' : 
                           event.confidence >= 0.6 ? 'text-yellow-400' : 'text-red-400';

    return (
      <div className="text-center space-y-6 animate-fade-in">
        <div className="text-6xl">✅</div>
        
        <div className="space-y-2">
          <div className="text-sm md:text-lg text-gray-400 uppercase tracking-widest">Answer</div>
          <div className="text-6xl sm:text-8xl md:text-9xl font-bold text-white bg-gray-800 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl border-4 border-green-500 min-h-[120px] sm:min-h-[160px] flex items-center justify-center">
            {event.answerId}
          </div>
        </div>

        {event.instruction && (
          <div className="bg-yellow-900/30 border border-yellow-500 rounded-xl p-4 sm:p-6">
            <div className="text-xs sm:text-sm text-yellow-400 uppercase tracking-widest mb-2">Instruction</div>
            <div className="text-lg sm:text-xl md:text-2xl text-yellow-300 font-medium">
              "{event.instruction}"
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
          <span className="text-sm sm:text-lg text-gray-400">Confidence:</span>
          <span className={`text-xl sm:text-2xl font-bold ${confidenceColor}`}>
            {confidencePercentage}%
          </span>
          <div className="w-24 sm:w-32 bg-gray-600 rounded-full h-2 sm:h-3">
            <div
              className={`h-2 sm:h-3 rounded-full transition-all duration-500 ${
                event.confidence >= 0.8 ? 'bg-green-500' : 
                event.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidencePercentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Assessment Teleprompter</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        {lastUpdate && (
          <div className="text-xs text-gray-500 mt-1">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {event.type === 'finalized' ? renderFinalizedAnswer() : renderStatus(event.status)}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 text-center text-sm text-gray-500">
        <p>Keep this page open to see real-time assessment answers</p>
        <p className="text-xs mt-1">Access from: {window.location.href}</p>
      </div>

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};