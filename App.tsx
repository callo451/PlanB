
import React, { useRef, useState, useEffect } from 'react';
import { useAssessmentOrchestrator } from './hooks/useAssessmentOrchestrator';
import { StatusIndicator } from './components/StatusIndicator';
import { FinalizedAnswer } from './components/FinalizedAnswer';
import { WebcamSelector } from './components/WebcamSelector';
import { Teleprompter } from './components/Teleprompter';
import type { AppEvent } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'main' | 'teleprompter'>('main');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const { event, isCapturing, toggleCapture } = useAssessmentOrchestrator({ videoRef, selectedDeviceId });

  // Simple URL-based routing
  useEffect(() => {
    const checkRoute = () => {
      const path = window.location.pathname + window.location.search;
      if (path.includes('teleprompter')) {
        setCurrentPage('teleprompter');
      } else {
        setCurrentPage('main');
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  // If teleprompter route, show teleprompter page
  if (currentPage === 'teleprompter') {
    return <Teleprompter />;
  }

  const renderContent = (e: AppEvent) => {
    switch (e.type) {
      case 'status':
        return <StatusIndicator status={e.status} />;
      case 'finalized':
        return <FinalizedAnswer {...e} />;
      default:
        return <StatusIndicator status="idle" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 flex flex-col items-center space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cyan-400">AI Assessment Practice Tool</h1>
          <p className="text-gray-400 mt-2">Simulating real-time question analysis and answering.</p>
        </div>
        
        <div className="relative w-full h-64 bg-gray-900/50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 overflow-hidden">
           <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-300 ${
              isCapturing ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {isCapturing && <div className="absolute inset-0 bg-black/50"></div>}
          <div className="relative z-10">
            {renderContent(event)}
          </div>
        </div>

        <div className="flex flex-col items-center space-y-4">
          <WebcamSelector
            selectedDeviceId={selectedDeviceId}
            onDeviceSelect={setSelectedDeviceId}
            disabled={isCapturing}
          />
          
          <button
            onClick={toggleCapture}
            className={`px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              isCapturing
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
                : 'bg-green-500 hover:bg-green-600 focus:ring-green-400 text-gray-900'
            }`}
          >
            {isCapturing ? 'Stop Capture' : 'Start Capture'}
          </button>
        </div>
      </div>
      <footer className="text-center mt-8 text-gray-500 text-sm space-y-2">
        <p>This is a training and experimentation tool. Not for use in real exams.</p>
        <div className="pt-2 border-t border-gray-700">
          <a 
            href="?teleprompter" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline text-sm"
          >
            📱 Open Teleprompter (Mobile)
          </a>
          <p className="text-xs text-gray-600 mt-1">Open this link on another device for mobile teleprompter view</p>
        </div>
      </footer>
    </div>
  );
};

export default App;