
import React, { useState, useEffect } from 'react';
import { getQuiz } from '../services/geminiService';
import { topicDB } from '../services/TopicDatabase';
import { QuizQuestion, Topic } from '../types';
import { Loader } from './Loader';
import { CheckCircle, XCircle, RefreshCw, Database, Layers } from './Icons';

interface QuizProps {
  topic: string;
}

export const Quiz: React.FC<QuizProps> = ({ topic }) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Initial Load: Get all topics from DB
  useEffect(() => {
    const allTopics = topicDB.getAllTopics();
    setAvailableTopics(allTopics);
    
    // Default to current active topic in DB, or the main one
    const current = topicDB.getCurrentTopic();
    if (current) {
      setActiveTopicId(current.id);
    } else if (allTopics.length > 0) {
      setActiveTopicId(allTopics[0].id);
    }
  }, []);

  useEffect(() => {
    if (activeTopicId) {
      loadQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopicId]);

  const loadQuiz = async () => {
    if (!activeTopicId) return;
    
    setLoading(true);
    setError(null);
    setQuizCompleted(false);
    setCurrentQIndex(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedOption(null);
    
    try {
      const dbTopic = topicDB.getTopicContent(activeTopicId);
      let loadedQuestions = dbTopic.quizzes;
      
      const topicObj = availableTopics.find(t => t.id === activeTopicId);

      // Fetch new if none exist and it's the main topic (or we want to force generation for demo)
      if (loadedQuestions.length === 0 && topicObj?.isMainTopic) {
        // Pass knowledge base if available
        const knowledge = topicDB.getKnowledgeBase(activeTopicId);
        loadedQuestions = await getQuiz(topicObj.name, knowledge);
        
        topicDB.addQuizQuestionsToTopic(activeTopicId, loadedQuestions);
      }

      setQuestions(loadedQuestions);
      setLoading(false);
    } catch (err) {
      setError("Failed to generate quiz.");
      setLoading(false);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === questions[currentQIndex].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full min-h-[500px]">
       
       {/* Sidebar: Topic Selection */}
       <div className="w-full md:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-2 h-fit">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2 px-2">
          <Database size={18} className="text-indigo-600"/>
          <h3>Quiz Topics</h3>
        </div>
        <div className="space-y-1">
          {availableTopics.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTopicId(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                activeTopicId === t.id 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate font-medium">{t.name}</span>
              {t.quizzes.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTopicId === t.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {t.quizzes.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Quiz Area */}
      <div className="flex-1">
        {loading ? <Loader message="Preparing your quiz..." /> :
         error ? <div className="text-red-500 text-center p-8">{error}</div> :
         questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 bg-white rounded-2xl border border-slate-200">
            <Layers size={48} className="mx-auto mb-4 opacity-20" />
            <p>No questions ready for this topic.</p>
            <p className="text-sm mt-2">Continue the lesson chat to generate quiz questions dynamically!</p>
          </div>
         ) :
         quizCompleted ? (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in bg-white rounded-2xl border border-slate-200 h-full">
            <div className="text-center max-w-md w-full">
              <div className="mb-6">
                {Math.round((score / questions.length) * 100) >= 80 ? (
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={40} />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RefreshCw size={40} />
                  </div>
                )}
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Quiz Complete!</h2>
                <p className="text-slate-500">You scored {score} out of {questions.length}</p>
              </div>
              
              <div className="text-6xl font-black text-slate-900 mb-8 tracking-tighter">
                {Math.round((score / questions.length) * 100)}%
              </div>

              <button
                onClick={loadQuiz}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-4">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Question {currentQIndex + 1}</span>
                <span>{questions.length} total</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500 ease-out" 
                  style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-8 leading-relaxed">
                {questions[currentQIndex].question}
              </h3>

              <div className="space-y-3">
                {questions[currentQIndex].options.map((option, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === questions[currentQIndex].correctAnswerIndex;
                  
                  // Determine styling state
                  let containerClass = "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50";
                  let icon = null;

                  if (isAnswered) {
                    if (isCorrect) {
                      containerClass = "border-green-500 bg-green-50 text-green-800";
                      icon = <CheckCircle size={20} className="text-green-600" />;
                    } else if (isSelected) {
                      containerClass = "border-red-500 bg-red-50 text-red-800";
                      icon = <XCircle size={20} className="text-red-500" />;
                    } else {
                      containerClass = "border-slate-100 opacity-50";
                    }
                  } else if (isSelected) {
                    containerClass = "border-indigo-500 bg-indigo-50";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isAnswered}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${containerClass}`}
                    >
                      <span className="font-medium">{option}</span>
                      {icon}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="mt-8 pt-6 border-t border-slate-100 animate-fade-in">
                  <div className="bg-slate-50 p-4 rounded-lg text-slate-700 text-sm mb-6">
                    <span className="font-bold block mb-1">Explanation:</span>
                    {questions[currentQIndex].explanation}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleNext}
                      className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      {currentQIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
