
import React from 'react';
import type { FinalizedEvent } from '../types';
import { CheckCircleIcon } from './IconComponents';

export const FinalizedAnswer: React.FC<FinalizedEvent> = ({ answerId, confidence, instruction }) => {
  const confidencePercentage = (confidence * 100).toFixed(0);

  return (
    <div className="flex flex-col items-center justify-center text-center w-full animate-fade-in">
        <div className="flex items-center text-green-400 gap-2">
            <CheckCircleIcon className="w-8 h-8"/>
            <h2 className="text-2xl font-bold">Answer Finalized</h2>
        </div>
      
        <div className="my-4 p-6 bg-gray-700/50 rounded-lg w-full max-w-sm">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Answer</p>
            <p className="text-6xl font-bold my-2 text-white">{answerId}</p>
        </div>

      {instruction && (
         <div className="w-full max-w-sm text-center">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Instruction</p>
            <p className="text-lg italic text-yellow-300 mt-1">"{instruction}"</p>
         </div>
      )}

      <div className="w-full max-w-xs mt-6">
        <div className="flex justify-between mb-1 text-sm font-medium text-gray-400">
          <span>Confidence</span>
          <span>{confidencePercentage}%</span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2.5">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${confidencePercentage}%` }}
          ></div>
        </div>
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
