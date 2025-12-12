
import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Chat } from "@google/genai";
import { 
  getInitialSlide, 
  getNextSlide, 
  getConceptImage, 
  createTutorChat, 
  summarizeSlideDiscussion
} from '../services/geminiService';
import { AgentOrchestrator } from '../services/AgentOrchestrator';
import { topicDB } from '../services/TopicDatabase';
import { Loader } from './Loader';
import { LessonSlide, ChatMessage, AgentMode } from '../types';
import { ChevronLeft, ChevronRight, Sparkles, Send, Layers, User, Bot, Film, Globe, FileText, Upload } from './Icons';

interface StudySessionProps {
  topic: string;
  onSwitchToVideo: () => void;
}

export const StudySession: React.FC<StudySessionProps> = ({ topic, onSwitchToVideo }) => {
  const [slides, setSlides] = useState<LessonSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatingNext, setGeneratingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // "Database" state
  const [lessonContext, setLessonContext] = useState<string>("");

  // Chat & Agent state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentTopicName, setCurrentTopicName] = useState(topic);
  const [agentMode, setAgentMode] = useState<AgentMode>(AgentMode.TUTOR);
  
  // Notebook State
  const [notebookContent, setNotebookContent] = useState("");
  const [isNotebookExpanded, setIsNotebookExpanded] = useState(false);
  
  const slideChatHistoryRef = useRef<ChatMessage[]>([]);
  const chatSessionRef = useRef<Chat | null>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Session
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const mainTopicName = topicDB.getMainTopicName();
        const savedSession = topicDB.getSessionState();

        if (mainTopicName === topic && savedSession) {
          // RESTORE
          if (isMounted) {
            setSlides(savedSession.slides);
            setCurrentSlideIndex(savedSession.currentSlideIndex);
            setLessonContext(savedSession.lessonContext);
            setChatMessages(savedSession.chatHistory);
            setCurrentTopicName(savedSession.currentTopicName);
            setAgentMode(savedSession.agentMode || AgentMode.TUTOR);
            
            // Restore Notebook Content
            const topicContent = topicDB.getTopicContent(topicDB.getCurrentTopic()?.id || "");
            setNotebookContent(topicContent.notebookContent);

            // Re-create Chat & Orchestrator
            chatSessionRef.current = createTutorChat(topic, savedSession.chatHistory);
            orchestratorRef.current = new AgentOrchestrator(chatSessionRef.current, savedSession.currentTopicName);
            
            setLoading(false);
            slideChatHistoryRef.current = [];
          }
        } else {
          // NEW SESSION
          setLessonContext("");
          setSlides([]);
          topicDB.reset(topic);
          setCurrentTopicName(topic);
          setAgentMode(AgentMode.TUTOR);
          
          const firstSlide = await getInitialSlide(topic);
          
          if (isMounted) {
            setSlides([firstSlide]);
            setLoading(false);
            
            // Initialize Chat & Orchestrator
            chatSessionRef.current = createTutorChat(topic);
            orchestratorRef.current = new AgentOrchestrator(chatSessionRef.current, topic);

            const introMsg: ChatMessage = {
              role: 'model',
              text: `Welcome! I'm your AI tutor. We're starting with **${topic}**. Read this slide, and ask me anything!`
            };
            setChatMessages([introMsg]);
            
            topicDB.addMessageToTopic(topicDB.getCurrentTopic()!.id, introMsg);
            slideChatHistoryRef.current = [];
            loadImageForSlide(0, firstSlide.imagePrompt);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to start the lesson. Please try again.");
          setLoading(false);
        }
      }
    };

    initSession();
    return () => { isMounted = false; };
  }, [topic]);

  // Save State
  useEffect(() => {
    if (!loading && slides.length > 0) {
      topicDB.setSessionState({
        slides,
        currentSlideIndex,
        lessonContext,
        chatHistory: chatMessages,
        currentTopicName,
        agentMode
      });
    }
  }, [slides, currentSlideIndex, lessonContext, chatMessages, currentTopicName, agentMode, loading]);

  // Update notebook content in DB
  const handleNotebookUpdate = (content: string) => {
    setNotebookContent(content);
    const currentId = topicDB.getCurrentTopic()?.id;
    if (currentId) {
      topicDB.updateNotebookContent(currentId, content);
    }
  };

  const loadImageForSlide = async (index: number, prompt: string) => {
    setSlides(prev => {
      const newSlides = [...prev];
      if (newSlides[index].imageUrl || newSlides[index].imageLoading) return prev;
      newSlides[index].imageLoading = true;
      return newSlides;
    });

    try {
      const imageBase64 = await getConceptImage(prompt);
      setSlides(prev => {
        const newSlides = [...prev];
        newSlides[index].imageUrl = imageBase64;
        newSlides[index].imageLoading = false;
        return newSlides;
      });
    } catch (e) {
      console.error("Image gen failed", e);
      setSlides(prev => {
        const newSlides = [...prev];
        newSlides[index].imageLoading = false;
        return newSlides;
      });
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !orchestratorRef.current) return;

    const userText = inputMessage;
    setInputMessage("");
    setIsChatLoading(true);

    // 1. Add User Msg to Current Topic
    const userMsg: ChatMessage = { role: 'user', text: userText };
    setChatMessages(prev => [...prev, userMsg]);
    slideChatHistoryRef.current.push(userMsg);
    
    // Capture current topic ID *before* processing, in case it changes
    const preShiftTopicId = topicDB.getCurrentTopic()?.id;
    if (preShiftTopicId) topicDB.addMessageToTopic(preShiftTopicId, userMsg);

    try {
      // 2. Delegate to Orchestrator
      const result = await orchestratorRef.current.processUserQuery(
        userText,
        agentMode,
        chatMessages.slice(-5),
        slides[currentSlideIndex].title
      );

      // 3. Handle Topic Shift
      if (result.analysis.isNewTopic && result.analysis.topicName !== currentTopicName) {
        // Update Local State
        setCurrentTopicName(result.analysis.topicName);
        orchestratorRef.current.updateTopic(result.analysis.topicName);
        
        // Update Database State: Create new topic if needed and switch to it
        let newTopic = topicDB.getTopicByName(result.analysis.topicName);
        if (!newTopic) {
           newTopic = topicDB.createTopic(result.analysis.topicName, false);
        }
        topicDB.setCurrentTopic(newTopic.id);
      }

      // 4. Update Chat UI
      setChatMessages(prev => [...prev, result.response]);
      slideChatHistoryRef.current.push(result.response);
      
      // 5. Add Model Response to the *Active* Topic (which might be new)
      const postShiftTopicId = topicDB.getCurrentTopic()?.id;
      if (postShiftTopicId) topicDB.addMessageToTopic(postShiftTopicId, result.response);

    } catch (err) {
      console.error("Chat error", err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error coordinating the agents." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleNextSlide = async () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      slideChatHistoryRef.current = [];
      return;
    }

    setGeneratingNext(true);
    try {
      const currentSlide = slides[currentSlideIndex];
      // 1. Summarize
      const summary = await summarizeSlideDiscussion(currentSlide.title, slideChatHistoryRef.current);
      
      // 2. Save Summary to DB (Knowledge Base)
      const currentTopicId = topicDB.getCurrentTopic()?.id;
      if (currentTopicId) {
        topicDB.appendKnowledge(currentTopicId, summary);
      }

      // 3. Update local context for slide generation
      const updatedContext = `${lessonContext}\n- Slide "${currentSlide.title}" Summary: ${summary}`;
      setLessonContext(updatedContext);

      // 4. Generate next
      const nextSlide = await getNextSlide(currentTopicName, currentSlide.title, updatedContext);

      setSlides(prev => [...prev, nextSlide]);
      setCurrentSlideIndex(prev => prev + 1);
      slideChatHistoryRef.current = [];
      
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: `Moving on! Here is a new slide about **${nextSlide.title}**.` 
      }]);

      loadImageForSlide(slides.length, nextSlide.imagePrompt); 

    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingNext(false);
    }
  };

  if (loading) return <Loader message={`Initializing Agent Swarm for ${topic}...`} />;
  if (error) return <div className="text-red-500 text-center p-8 bg-red-50 rounded-xl">{error}</div>;
  if (slides.length === 0) return null;

  const currentSlide = slides[currentSlideIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)] min-h-[700px]">
      
      {/* LEFT COLUMN: SLIDES */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-white/50 overflow-hidden flex flex-col relative transform transition-all">
           
           <div className="h-72 bg-slate-900 relative group overflow-hidden shrink-0">
             {currentSlide.imageLoading ? (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                 <div className="flex flex-col items-center gap-3">
                   <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full opacity-80"></div>
                   <span className="text-xs text-indigo-600 font-bold uppercase tracking-wider animate-pulse">Designing Diagram...</span>
                 </div>
               </div>
             ) : currentSlide.imageUrl ? (
               <img 
                 src={currentSlide.imageUrl} 
                 alt={currentSlide.title} 
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 opacity-90"
               />
             ) : (
               <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                 Generating visualization...
               </div>
             )}
             
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent flex flex-col justify-end p-8">
               <div className="transform translate-y-0 transition-transform duration-500">
                  <span className="inline-block px-3 py-1 bg-indigo-500/30 backdrop-blur-md border border-indigo-500/30 text-indigo-100 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                    {currentTopicName}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-sm">
                    {currentSlide.title}
                  </h2>
               </div>
             </div>
           </div>

           <div className="p-8 md:p-10 overflow-y-auto prose prose-slate prose-lg max-w-none flex-grow bg-white">
             <ReactMarkdown 
               components={{
                 h1: ({node, ...props}) => <h3 className="text-indigo-600 font-bold text-xl mb-4" {...props} />,
                 h2: ({node, ...props}) => <h4 className="text-slate-800 font-bold text-lg mb-3" {...props} />,
                 p: ({node, ...props}) => <p className="text-slate-600 leading-relaxed mb-4" {...props} />,
                 li: ({node, ...props}) => <li className="text-slate-600 mb-2" {...props} />,
                 strong: ({node, ...props}) => <strong className="text-indigo-700 font-semibold" {...props} />,
               }}
             >
               {currentSlide.content}
             </ReactMarkdown>
           </div>

           <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-sm flex justify-between items-center sticky bottom-0">
             <button
               onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
               disabled={currentSlideIndex === 0 || generatingNext}
               className="flex items-center gap-2 px-5 py-3 rounded-xl hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 font-medium transition-all"
             >
               <ChevronLeft size={20} />
               <span>Back</span>
             </button>
             
             <div className="flex flex-col items-center">
               {generatingNext ? (
                  <span className="flex items-center gap-2 text-indigo-600 text-sm font-semibold animate-pulse">
                    <Sparkles size={16} />
                    Thinking...
                  </span>
               ) : (
                 <div className="flex gap-1">
                    {slides.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlideIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'}`}
                      />
                    ))}
                 </div>
               )}
             </div>

             <button
               onClick={handleNextSlide}
               disabled={generatingNext}
               className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-95 font-medium"
             >
               <span>{currentSlideIndex === slides.length - 1 ? 'Next Concept' : 'Next Slide'}</span>
               <ChevronRight size={20} />
             </button>
           </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AGENT CHAT */}
      <div className="w-full lg:w-[450px] flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
        
        {/* Agent Mode Tabs */}
        <div className="flex border-b border-slate-100">
           <button 
             onClick={() => setAgentMode(AgentMode.TUTOR)}
             className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${agentMode === AgentMode.TUTOR ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Bot size={16} /> Tutor
           </button>
           <button 
             onClick={() => setAgentMode(AgentMode.NOTEBOOK)}
             className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${agentMode === AgentMode.NOTEBOOK ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <FileText size={16} /> Notebook
           </button>
           <button 
             onClick={() => setAgentMode(AgentMode.RESEARCH)}
             className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${agentMode === AgentMode.RESEARCH ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Globe size={16} /> Research
           </button>
        </div>

        {/* Notebook Upload Area (Visible only in Notebook Mode) */}
        {agentMode === AgentMode.NOTEBOOK && (
           <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
              <button 
                onClick={() => setIsNotebookExpanded(!isNotebookExpanded)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wide mb-1"
              >
                 <span>User Context ({notebookContent.length} chars)</span>
                 <Upload size={14} />
              </button>
              {(isNotebookExpanded || notebookContent.length === 0) && (
                 <textarea
                   value={notebookContent}
                   onChange={(e) => handleNotebookUpdate(e.target.value)}
                   placeholder="Paste your notes, article text, or PDF content here to chat with it..."
                   className="w-full h-32 text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-700 mt-2"
                 />
              )}
           </div>
        )}

        {/* Messages Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50 scroll-smooth">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-fade-in-up`}>
              
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div className="flex flex-col gap-1 max-w-[85%]">
                <div 
                  className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                
                {/* Sources Display for Research Agent */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.sources.slice(0, 3).map((source, sIdx) => (
                      <a 
                        key={sIdx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md text-indigo-600 hover:underline shadow-sm"
                      >
                        <Globe size={10} />
                        <span className="truncate max-w-[150px]">{source.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div className="flex gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} />
               </div>
               <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 w-fit shadow-sm">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          
          <div className="flex gap-2 overflow-x-auto pb-3 -mt-2 hide-scrollbar">
            <button 
               onClick={onSwitchToVideo}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-full border border-purple-100 transition-colors whitespace-nowrap"
            >
              <Film size={12} />
              Generate Video
            </button>
             <button 
               onClick={handleNextSlide}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 transition-colors whitespace-nowrap"
            >
              <Sparkles size={12} />
              Next Slide
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="relative flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                agentMode === AgentMode.TUTOR ? `Ask the Tutor about ${currentTopicName}...` :
                agentMode === AgentMode.RESEARCH ? `Research web for ${currentTopicName}...` :
                `Ask about your notes...`
              }
              disabled={generatingNext}
              className="flex-1 px-5 py-4 bg-white text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={!inputMessage.trim() || isChatLoading || generatingNext}
              className="px-4 py-2 m-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium flex items-center justify-center gap-1">
             <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
             Active Agent: <strong>{agentMode}</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
