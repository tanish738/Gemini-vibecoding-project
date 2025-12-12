import React, { useState, useEffect } from 'react';
import { generateEducationalVideo } from '../services/geminiService';
import { Loader } from './Loader';
import { Film, Lock, PlayCircle, Sparkles, XCircle } from './Icons';
import { topicDB } from '../services/TopicDatabase';

interface VideoLearningProps {
  topic: string;
}

export const VideoLearning: React.FC<VideoLearningProps> = ({ topic }) => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [progress, setProgress] = useState(0);

  // Check for cached video or API key on mount
  useEffect(() => {
    const checkKey = async () => {
      const hasSelected = await (window as any).aistudio.hasSelectedApiKey();
      setHasKey(hasSelected);
    };
    checkKey();

    // Check if we already generated a video for this topic in this session
    const currentTopic = topicDB.getCurrentTopic();
    if (currentTopic?.videoUri) {
      setVideoUri(currentTopic.videoUri);
    }
  }, [topic]);

  const handleSelectKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      // After selecting, verify again
      const hasSelected = await (window as any).aistudio.hasSelectedApiKey();
      setHasKey(hasSelected);
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    
    // Simulate progress while waiting for real API polling
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 1 : prev));
    }, 1000); // Increment every second

    try {
      const uri = await generateEducationalVideo(topic);
      setVideoUri(uri);
      
      // Cache it
      const currentTopicId = topicDB.getCurrentTopic()?.id;
      if (currentTopicId) {
        // We'd ideally need a setter in topicDB, but for now we modify the object reference
        const t = topicDB.getCurrentTopic();
        if (t) t.videoUri = uri;
      }

    } catch (err: any) {
      let msg = "Failed to generate video. Please try again.";
      if (err.message?.includes("Requested entity was not found")) {
        msg = "API Key Error. Please re-select your key.";
        setHasKey(false);
      }
      setError(msg);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-8 text-center animate-fade-in">
        <div className="bg-indigo-50 p-6 rounded-full mb-6">
          <Lock size={48} className="text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Unlock Video Generation</h2>
        <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
          AI Video generation requires a paid Google Cloud Project API key. 
          Please select your key to create custom educational videos for "<strong>{topic}</strong>".
        </p>
        <button
          onClick={handleSelectKey}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
        >
          <Sparkles size={20} />
          Select API Key & Enable
        </button>
        <p className="mt-6 text-xs text-slate-400">
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-indigo-500">
            Learn more about billing
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[600px] animate-fade-in">
      {!videoUri && !loading && (
        <div className="text-center max-w-lg">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl shadow-xl mb-8 inline-block transform hover:scale-105 transition-transform duration-500">
            <Film size={64} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">Visualize {topic}</h2>
          <p className="text-slate-600 mb-10 text-lg">
            Generate a custom 720p educational video to explain this concept visually using the Veo model.
          </p>
          <button
            onClick={handleGenerate}
            className="px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-xl hover:shadow-2xl flex items-center gap-3 mx-auto"
          >
            <Sparkles size={24} className="text-yellow-400" />
            Generate Video Explanation
          </button>
          <p className="mt-6 text-sm text-slate-400 font-medium">
            Note: Generation takes about 1-2 minutes.
          </p>
        </div>
      )}

      {loading && (
        <div className="w-full max-w-md text-center">
          <Loader message={`Creating video script and rendering visuals for ${topic}...`} />
          <div className="w-full bg-slate-200 h-2 rounded-full mt-8 overflow-hidden">
             <div 
               className="bg-indigo-600 h-full transition-all duration-1000 ease-linear" 
               style={{ width: `${Math.min(progress, 95)}%` }}
             ></div>
          </div>
          <p className="text-xs text-slate-400 mt-4 font-mono">
            {progress < 30 ? "Initializing Veo model..." : 
             progress < 60 ? "Rendering frames..." : 
             "Finalizing video encoding..."}
          </p>
        </div>
      )}

      {error && (
        <div className="text-center p-8 bg-red-50 rounded-2xl border border-red-100 max-w-md">
          <XCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-800 mb-2">Generation Failed</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-sm font-semibold text-red-700 hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      {videoUri && (
        <div className="w-full max-w-4xl bg-black rounded-3xl overflow-hidden shadow-2xl ring-8 ring-slate-100">
          <div className="relative aspect-video bg-black flex items-center justify-center">
             <video 
               src={videoUri} 
               controls 
               autoPlay 
               className="w-full h-full"
               poster="https://via.placeholder.com/1280x720/000000/FFFFFF?text=MindSpark+Video"
             >
               Your browser does not support the video tag.
             </video>
          </div>
          <div className="p-6 bg-white flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-slate-900">{topic} Explanation</h3>
              <p className="text-sm text-slate-500">Generated by Veo</p>
            </div>
            <button 
              onClick={handleGenerate}
              className="px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles size={16} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
