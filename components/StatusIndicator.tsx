
import React from 'react';
import { SpinnerIcon, ReadyIcon } from './IconComponents';

interface StatusIndicatorProps {
  status: 'idle' | 'reading' | 'proposing';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center text-gray-500">
        <ReadyIcon className="w-16 h-16 mb-4"/>
        <span className="text-xl font-medium">Ready</span>
        <p className="text-sm">Start capture to begin analysis</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-cyan-400">
      <SpinnerIcon className="w-16 h-16 animate-spin mb-4" />
      <span className="text-xl font-medium">Reading Screen...</span>
       <p className="text-sm text-gray-400">Analyzing content to find the answer</p>
    </div>
  );
};
