
import React, { useState, useEffect } from 'react';
import { getFlashcards } from '../services/geminiService';
import { topicDB } from '../services/TopicDatabase';
import { Flashcard, Topic } from '../types';
import { Loader } from './Loader';
import { ChevronLeft, ChevronRight, RotateCcw, Layers, Database } from './Icons';

interface FlashcardsProps {
  topic: string;
}

export const Flashcards: React.FC<FlashcardsProps> = ({ topic }) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

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

  // When active topic changes, load cards
  useEffect(() => {
    if (!activeTopicId) return;

    const loadCardsForTopic = async () => {
      setLoading(true);
      setError(null);
      setCurrentIndex(0);
      setIsFlipped(false);
      
      try {
        const dbTopic = topicDB.getTopicContent(activeTopicId);
        let loadedCards = dbTopic.flashcards;
        const topicObj = availableTopics.find(t => t.id === activeTopicId);

        // If no cards exist for this topic (and it's the Main one), try to fetch generic ones
        if (loadedCards.length === 0 && topicObj?.isMainTopic) {
           // Pass knowledge base if available for better quality
           const knowledge = topicDB.getKnowledgeBase(activeTopicId);
           loadedCards = await getFlashcards(topicObj.name, knowledge);
           
           // Save them back to DB so we don't fetch again
           topicDB.addFlashcardsToTopic(activeTopicId, loadedCards);
        }

        setCards(loadedCards);
        setLoading(false);
      } catch (err) {
        setError("Failed to load flashcards.");
        setLoading(false);
      }
    };

    loadCardsForTopic();
  }, [activeTopicId, availableTopics]);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full min-h-[500px]">
      
      {/* Sidebar: Topic Selection */}
      <div className="w-full md:w-64 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-2 h-fit">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2 px-2">
          <Database size={18} className="text-indigo-600"/>
          <h3>Discussed Topics</h3>
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
              {t.flashcards.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTopicId === t.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {t.flashcards.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Flashcard Area */}
      <div className="flex-1 bg-slate-50/50 rounded-2xl flex items-center justify-center p-4">
        {loading ? (
          <Loader message="Organizing study material..." />
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : cards.length === 0 ? (
          <div className="text-center p-8 text-slate-400">
            <Layers size={48} className="mx-auto mb-4 opacity-20" />
            <p>No flashcards generated for this topic yet.</p>
            <p className="text-sm mt-2">Chat more about "{availableTopics.find(t => t.id === activeTopicId)?.name}" to generate cards!</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-6 text-slate-500 font-medium">
              <span>Card {currentIndex + 1} of {cards.length}</span>
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold truncate max-w-[200px]">
                 {availableTopics.find(t => t.id === activeTopicId)?.name}
              </span>
            </div>

            <div 
              className="relative w-full aspect-[3/2] perspective-1000 cursor-pointer group"
              onClick={handleFlip}
            >
              <div className={`relative w-full h-full duration-500 transform-style-3d transition-all ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front */}
                <div className="absolute w-full h-full backface-hidden bg-white border border-slate-200 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8 text-center hover:shadow-xl transition-shadow">
                  <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-4">Question</h3>
                  <p className="text-xl md:text-2xl font-medium text-slate-800">{cards[currentIndex].front}</p>
                  <p className="absolute bottom-6 text-xs text-slate-400 font-medium group-hover:text-indigo-400 transition-colors">
                    Click to flip
                  </p>
                </div>

                {/* Back */}
                <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-indigo-600 rounded-3xl shadow-lg flex flex-col items-center justify-center p-8 text-center">
                  <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-widest mb-4">Answer</h3>
                  <p className="text-lg md:text-xl font-medium text-white">{cards[currentIndex].back}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-8">
              <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className="p-4 rounded-full bg-white shadow-md text-slate-700 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentIndex(0);
                }}
                className="p-3 text-slate-400 hover:text-slate-600 transition-colors flex flex-col items-center gap-1"
              >
                 <RotateCcw size={20} />
                 <span className="text-xs">Reset</span>
              </button>

              <button 
                onClick={handleNext} 
                disabled={currentIndex === cards.length - 1}
                className="p-4 rounded-full bg-indigo-600 shadow-md text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-indigo-200"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
