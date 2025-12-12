
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateExam, gradeExam } from '../services/geminiService';
import { topicDB } from '../services/TopicDatabase';
import { ExamQuestion, ExamFeedback, Topic } from '../types';
import { Loader } from './Loader';
import { CheckCircle, XCircle, FileText, Lock, ClipboardList, Target, ArrowRight, Database } from './Icons';

interface ExamModeProps {
  topic: string; // This is the main app topic, but we allow selecting specific sub-topics
  onExamStart: () => void;
  onExamEnd: () => void;
}

export const ExamMode: React.FC<ExamModeProps> = ({ topic, onExamStart, onExamEnd }) => {
  const [step, setStep] = useState<'SELECT_TOPIC' | 'CONSENT' | 'EXAM' | 'RESULTS'>('SELECT_TOPIC');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopicName, setSelectedTopicName] = useState<string>("");
  
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingResults, setAnalyzingResults] = useState(false);
  
  // Stores answer by Question ID. For MCQ it's index (number), for Short Answer it's text (string).
  const [userAnswers, setUserAnswers] = useState<Record<string, string | number>>({});
  
  const [feedback, setFeedback] = useState<ExamFeedback | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);

  // Load available topics on mount
  useEffect(() => {
    const topics = topicDB.getAllTopics().filter(t => t.knowledgeBase.length > 0 || t.isMainTopic);
    setAvailableTopics(topics);
    
    // Auto-select current if valid
    const current = topicDB.getCurrentTopic();
    if (current) {
      setSelectedTopicId(current.id);
      setSelectedTopicName(current.name);
    } else if (topics.length > 0) {
      setSelectedTopicId(topics[0].id);
      setSelectedTopicName(topics[0].name);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      onExamEnd();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTopicSelect = (t: Topic) => {
    setSelectedTopicId(t.id);
    setSelectedTopicName(t.name);
  };

  const proceedToConsent = () => {
    if (selectedTopicId) setStep('CONSENT');
  };

  const startExam = async () => {
    if (!selectedTopicId) return;
    
    setLoading(true);
    onExamStart(); // Lock the app
    
    try {
      // 1. Check if exam already exists for this topic
      const existingExam = topicDB.getExamQuestionsForTopic(selectedTopicId);
      
      if (existingExam && existingExam.length > 0) {
         setQuestions(existingExam);
      } else {
         // 2. Generate new exam based on knowledge base
         const context = topicDB.getKnowledgeBase(selectedTopicId);
         const newQuestions = await generateExam(selectedTopicName, context);
         
         setQuestions(newQuestions);
         topicDB.setExamQuestionsForTopic(selectedTopicId, newQuestions);
      }
      
      setStep('EXAM');
    } catch (e) {
      console.error("Failed to load exam", e);
      // Ensure we unlock if failure happens immediately
      onExamEnd();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerMCQ = (qId: string, optionIndex: number) => {
    setUserAnswers(prev => ({ ...prev, [qId]: optionIndex }));
  };

  const handleAnswerText = (qId: string, text: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: text }));
  };

  const handleSubmit = async () => {
    setAnalyzingResults(true);
    
    try {
      const resultFeedback = await gradeExam(selectedTopicName, questions, userAnswers);
      setFeedback(resultFeedback);
    } catch (e) {
      console.error("Feedback generation failed", e);
    }

    setStep('RESULTS');
    setAnalyzingResults(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExit = () => {
    setStep('SELECT_TOPIC');
    setQuestions([]);
    setUserAnswers({});
    setFeedback(null);
    onExamEnd(); // Unlock app
  };

  // --- RENDER STEPS ---

  if (step === 'SELECT_TOPIC') {
    return (
       <div className="flex flex-col items-center justify-center min-h-[500px] py-12 animate-fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 max-w-2xl w-full text-center">
             <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Database size={32} />
             </div>
             <h2 className="text-3xl font-black text-slate-900 mb-2">Select Exam Topic</h2>
             <p className="text-slate-500 mb-8">Choose a module you have studied to take the final assessment.</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[300px] overflow-y-auto p-2">
                {availableTopics.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTopicSelect(t)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                       selectedTopicId === t.id 
                       ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-md' 
                       : 'border-slate-100 hover:border-indigo-200 text-slate-600'
                    }`}
                  >
                     <div className="font-bold truncate">{t.name}</div>
                     <div className="text-xs text-slate-400 mt-1 flex justify-between">
                        <span>{new Date(t.timestamp).toLocaleDateString()}</span>
                        {t.isMainTopic && <span className="uppercase text-[10px] font-bold tracking-wider text-indigo-500">Main Topic</span>}
                     </div>
                  </button>
                ))}
             </div>
             
             <button 
                onClick={proceedToConsent}
                disabled={!selectedTopicId}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
             >
                Continue to Exam <ArrowRight size={20} />
             </button>
          </div>
       </div>
    );
  }

  if (step === 'CONSENT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] py-12 animate-fade-in">
         <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 max-w-lg text-center">
            <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ClipboardList size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">Final Exam: {selectedTopicName}</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              You are about to start a comprehensive exam with mixed question types (Multiple Choice & Short Answer).
              <br/><br/>
              <span className="font-bold text-slate-800 flex items-center justify-center gap-2">
                <Lock size={16}/> Application Locked
              </span>
              Once you begin, navigation will be disabled until you submit.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={startExam}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Generating Questions...' : (
                  <>
                    <span>I'm Ready, Start Exam</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
              <button 
                onClick={() => setStep('SELECT_TOPIC')}
                className="w-full py-3 text-slate-500 hover:text-slate-800 font-semibold transition-colors"
              >
                Back to Topic Selection
              </button>
            </div>
         </div>
      </div>
    );
  }

  if (loading) return <Loader message={`Generating custom exam for ${selectedTopicName} based on your study session...`} />;
  if (analyzingResults) return <Loader message="AI Professor is grading your exam..." />;

  // --- RESULTS VIEW ---
  if (step === 'RESULTS' && feedback) {
    const percentage = Math.round((feedback.score / feedback.totalQuestions) * 100) || 0;
    
    return (
      <div className="max-w-5xl mx-auto animate-fade-in pb-12">
        {/* Score Header */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
          <div className="bg-slate-900 p-8 text-center text-white relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-slate-900"></div>
             <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2 text-slate-300 uppercase tracking-widest">Exam Results</h2>
                <div className={`text-7xl font-black my-4 text-transparent bg-clip-text bg-gradient-to-r ${percentage >= 70 ? 'from-green-400 to-emerald-500' : 'from-amber-400 to-orange-500'}`}>
                  {percentage}%
                </div>
                <p className="text-slate-400 text-lg">Score: {feedback.score.toFixed(1)} / {feedback.totalQuestions}</p>
             </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div>
                <h3 className="flex items-center gap-2 font-bold text-green-700 mb-4">
                  <CheckCircle size={20} /> Strengths
                </h3>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-slate-600 bg-green-50 px-3 py-2 rounded-lg border border-green-100">{s}</li>
                  ))}
                </ul>
             </div>
             <div>
                <h3 className="flex items-center gap-2 font-bold text-red-700 mb-4">
                  <Target size={20} /> Improvements
                </h3>
                <ul className="space-y-2">
                  {feedback.weaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-slate-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{w}</li>
                  ))}
                </ul>
             </div>
          </div>
        </div>

        {/* Study Plan */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
             <FileText className="text-indigo-600" />
             Personalized Study Plan
          </h3>
          <div className="prose prose-slate prose-indigo max-w-none">
             <ReactMarkdown>{feedback.studyPlan}</ReactMarkdown>
          </div>
        </div>

        {/* Detailed Review */}
        <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">Detailed Grading</h3>
        <div className="space-y-6 mb-12">
          {questions.map((q, idx) => {
             const aiComment = feedback.questionFeedback[idx] || "No specific feedback provided.";
             
             return (
               <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">{q.type === 'MCQ' ? 'Multiple Choice' : 'Short Note'}</span>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">{q.question}</h3>
                        
                        {/* Render User Answer vs Model Answer */}
                        <div className="mb-4 bg-slate-50 p-4 rounded-xl text-sm space-y-2">
                           <div>
                              <span className="font-bold text-slate-500 block text-xs uppercase">Your Answer</span>
                              {q.type === 'MCQ' 
                                 ? <span className="font-medium text-slate-800">{q.options?.[userAnswers[q.id] as number] || "Skipped"}</span>
                                 : <p className="text-slate-800 italic">"{userAnswers[q.id]}"</p>
                              }
                           </div>
                           {q.type === 'MCQ' && (
                              <div>
                                 <span className="font-bold text-slate-500 block text-xs uppercase mt-2">Correct Answer</span>
                                 <span className="font-medium text-green-700">{q.options?.[q.correctAnswerIndex || 0]}</span>
                              </div>
                           )}
                        </div>

                        {/* AI Feedback */}
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm text-indigo-900">
                           <span className="font-bold block mb-1 text-indigo-400 text-xs uppercase flex items-center gap-1">
                              <Target size={12}/> AI Grader Feedback
                           </span>
                           {aiComment}
                        </div>
                     </div>
                  </div>
               </div>
             );
          })}
        </div>

        <div className="flex justify-center">
             <button 
               onClick={handleExit}
               className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-xl"
             >
               Exit & Unlock App
             </button>
        </div>
      </div>
    )
  }

  // --- EXAM TAKING MODE ---
  return (
    <div className="max-w-3xl mx-auto pb-28 animate-fade-in relative">
      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-8 flex items-center gap-3 sticky top-20 z-10 shadow-sm">
         <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
           <Lock size={18} />
         </div>
         <div className="flex-1">
           <h3 className="font-bold text-amber-900 text-sm">Exam In Progress: {selectedTopicName}</h3>
           <p className="text-xs text-amber-700">Content based on your study session.</p>
         </div>
         <div className="text-amber-900 font-mono font-bold text-lg bg-white/50 px-3 py-1 rounded-lg">
           {Object.keys(userAnswers).length} / {questions.length}
         </div>
      </div>

      <div className="space-y-8">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-6">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question {idx + 1}</span>
               <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded uppercase">{q.type === 'MCQ' ? 'Select One' : 'Short Note'}</span>
             </div>
             
             <h3 className="text-xl font-bold text-slate-800 mb-6 leading-relaxed">{q.question}</h3>
             
             {q.type === 'MCQ' ? (
               <div className="space-y-3">
                 {q.options?.map((opt, optIdx) => (
                   <button
                     key={optIdx}
                     onClick={() => handleAnswerMCQ(q.id, optIdx)}
                     className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                       userAnswers[q.id] === optIdx 
                         ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold shadow-sm' 
                         : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-600'
                     }`}
                   >
                     <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${userAnswers[q.id] === optIdx ? 'border-indigo-600' : 'border-slate-300'}`}>
                          {userAnswers[q.id] === optIdx && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div>}
                        </div>
                        {opt}
                     </div>
                   </button>
                 ))}
               </div>
             ) : (
               <div>
                  <textarea
                    value={userAnswers[q.id] || ''}
                    onChange={(e) => handleAnswerText(q.id, e.target.value)}
                    placeholder="Type your answer here... (be concise)"
                    className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none transition-all text-slate-700 leading-relaxed"
                  />
                  <p className="text-xs text-slate-400 mt-2 text-right">
                    {(userAnswers[q.id]?.toString().length || 0)} chars
                  </p>
               </div>
             )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-200 flex justify-center z-40 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.1)]">
        <button
          onClick={handleSubmit}
          disabled={Object.keys(userAnswers).length < questions.length}
          className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xl transition-all w-full max-w-md flex items-center justify-center gap-2"
        >
           {Object.keys(userAnswers).length < questions.length ? (
             <span>Answer all questions ({Object.keys(userAnswers).length}/{questions.length})</span>
           ) : (
             <>
              <span>Submit for Grading</span>
              <ArrowRight size={20} />
             </>
           )}
        </button>
      </div>
    </div>
  );
};
