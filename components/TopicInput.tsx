import React, { useState } from 'react';
import { Sparkles, ArrowRight } from './Icons';

interface TopicInputProps {
  onSearch: (topic: string) => void;
  isLoading: boolean;
}

export const TopicInput: React.FC<TopicInputProps> = ({ onSearch, isLoading }) => {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-12 text-center px-4">
      <div className="inline-block p-3 rounded-2xl bg-indigo-50 mb-6 animate-fade-in-up">
        <Sparkles className="w-8 h-8 text-indigo-600" />
      </div>
      
      <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        Master any topic <br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">in minutes.</span>
      </h1>
      
      <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        Your personal AI tutor that creates interactive lessons, visualizes concepts, and quizzes you instantly.
      </p>
      
      <form onSubmit={handleSubmit} className="relative group max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
        <div className="relative flex items-center bg-white rounded-2xl shadow-xl overflow-hidden p-1.5">
          <input
            type="text"
            className="flex-grow px-6 py-4 text-lg text-slate-700 placeholder-slate-400 focus:outline-none bg-transparent"
            placeholder="What do you want to learn today?"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
          >
            {isLoading ? (
              <span className="opacity-80">Loading...</span>
            ) : (
              <>
                <span>Start</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 flex justify-center gap-4 text-sm text-slate-400 font-medium animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <span>Try:</span>
        <button onClick={() => setValue("Quantum Physics")} className="hover:text-indigo-600 transition-colors">Quantum Physics</button>
        <span>•</span>
        <button onClick={() => setValue("French Revolution")} className="hover:text-indigo-600 transition-colors">French Revolution</button>
        <span>•</span>
        <button onClick={() => setValue("Machine Learning")} className="hover:text-indigo-600 transition-colors">Machine Learning</button>
      </div>
    </div>
  );
};