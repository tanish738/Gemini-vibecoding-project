
import React, { useState } from 'react';
import { Flashcards } from './Flashcards';
import { Quiz } from './Quiz';
import { BookOpen, BrainCircuit } from './Icons';

interface PracticeModeProps {
  topic: string;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({ topic }) => {
  const [activeTab, setActiveTab] = useState<'FLASHCARDS' | 'QUIZ'>('FLASHCARDS');

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Practice Mode Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
          <button
            onClick={() => setActiveTab('FLASHCARDS')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'FLASHCARDS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BookOpen size={18} />
            <span>Flashcards</span>
          </button>
          <button
            onClick={() => setActiveTab('QUIZ')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'QUIZ'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <BrainCircuit size={18} />
            <span>Interactive Quiz</span>
          </button>
        </div>
      </div>

      <div className="flex-grow">
        {activeTab === 'FLASHCARDS' && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Review Concepts</h2>
              <p className="text-slate-500">Master the details through spaced repetition.</p>
            </div>
            <Flashcards topic={topic} />
          </div>
        )}
        {activeTab === 'QUIZ' && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Quick Check</h2>
              <p className="text-slate-500">Test your knowledge with immediate feedback.</p>
            </div>
            <Quiz topic={topic} />
          </div>
        )}
      </div>
    </div>
  );
};
