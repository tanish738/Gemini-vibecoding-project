
import React, { useState } from 'react';
import { TopicInput } from './components/TopicInput';
import { StudySession } from './components/StudySession';
import { PracticeMode } from './components/PracticeMode';
import { ExamMode } from './components/ExamMode';
import { VideoLearning } from './components/VideoLearning';
import { BookOpen, BrainCircuit, Lightbulb, ClipboardList, Target, Film, ChevronLeft, Lock } from './components/Icons';
import { AppMode } from './types';

function App() {
  const [topic, setTopic] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.IDLE);
  const [isExamActive, setIsExamActive] = useState(false);
  
  // State to manage sub-view for Video within the Learn tab
  const [showVideoInLearn, setShowVideoInLearn] = useState(false);

  const handleStart = (newTopic: string) => {
    setTopic(newTopic);
    setActiveMode(AppMode.LEARN);
    setShowVideoInLearn(false);
    setIsExamActive(false);
  };

  const navItems = [
    { id: AppMode.LEARN, label: 'Deep Dive & Learn', icon: Lightbulb, description: "Research, Chat, Videos" },
    { id: AppMode.PRACTICE, label: 'Prep & Practice', icon: Target, description: "Flashcards, Quick Quiz" },
    { id: AppMode.EXAM, label: 'Final Exam', icon: ClipboardList, description: "Assessment Mode" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      
      {/* Dynamic Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${topic ? 'bg-white/80 backdrop-blur-md border-b border-slate-200' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className={`flex items-center gap-2 group ${isExamActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => { 
              if (!isExamActive) {
                setTopic(null); 
                setActiveMode(AppMode.IDLE); 
              }
            }}
          >
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">MindSpark</span>
          </div>
          
          {topic && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50 relative">
              {isExamActive && (
                <div className="absolute inset-0 z-50 bg-slate-200/50 rounded-full flex items-center justify-center backdrop-blur-[1px] cursor-not-allowed">
                  <div className="bg-white px-3 py-1 rounded-full shadow-sm flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Lock size={12} /> Exam in Progress
                  </div>
                </div>
              )}
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMode === item.id;
                return (
                  <button
                    key={item.id}
                    disabled={isExamActive}
                    onClick={() => {
                        setActiveMode(item.id);
                        if (item.id === AppMode.LEARN) setShowVideoInLearn(false);
                    }}
                    className={`
                      flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200
                      ${isActive 
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-100 transform scale-105' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}
                      ${isExamActive ? 'opacity-50' : ''}
                    `}
                  >
                    <Icon size={16} className={isActive ? "stroke-2" : "stroke-2"} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {topic && (
             <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <span className="hidden sm:inline">Current Topic:</span>
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 font-bold truncate max-w-[150px]">
                  {topic}
                </span>
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 min-h-screen flex flex-col">
        {!topic ? (
          <div className="flex flex-col items-center justify-center flex-grow">
            <TopicInput onSearch={handleStart} isLoading={false} />
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-6xl">
              {[
                { title: "Deep Dive & Learn", desc: "Interactive slides, web research, document analysis, and AI videos.", icon: Lightbulb },
                { title: "Prep & Practice", desc: "Reinforce learning with dynamic flashcards and interactive feedback.", icon: Target },
                { title: "Exam Simulation", desc: "Test your knowledge with comprehensive, graded exams.", icon: ClipboardList }
              ].map((feature, i) => (
                <div key={i} className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 border border-slate-100 transition-all duration-300">
                  <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300">
                    <feature.icon size={28} />
                  </div>
                  <h3 className="font-bold text-xl mb-3 text-slate-800">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in w-full h-full flex flex-col">
            {/* Mobile Nav (Visible only on small screens) */}
            <div className="md:hidden flex justify-center mb-6 relative">
              {isExamActive && (
                 <div className="absolute inset-0 z-50 bg-slate-200/50 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                   <Lock size={20} className="text-slate-600" />
                 </div>
              )}
              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex w-full overflow-x-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeMode === item.id;
                  return (
                    <button
                      key={item.id}
                      disabled={isExamActive}
                      onClick={() => setActiveMode(item.id)}
                      className={`
                        flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                        ${isActive 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-500'}
                      `}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow">
              {activeMode === AppMode.LEARN && (
                <>
                    {showVideoInLearn ? (
                         <div className="relative">
                            <button 
                                onClick={() => setShowVideoInLearn(false)}
                                className="mb-4 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm"
                            >
                                <ChevronLeft size={16}/> Back to Study Session
                            </button>
                            <VideoLearning topic={topic} />
                         </div>
                    ) : (
                        <StudySession topic={topic} onSwitchToVideo={() => setShowVideoInLearn(true)} />
                    )}
                </>
              )}
              {activeMode === AppMode.PRACTICE && <PracticeMode topic={topic} />}
              {activeMode === AppMode.EXAM && (
                 <ExamMode 
                    topic={topic} 
                    onExamStart={() => setIsExamActive(true)}
                    onExamEnd={() => setIsExamActive(false)}
                 />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
