
import { GoogleGenAI, Type, Chat, Content } from "@google/genai";
import { Flashcard, QuizQuestion, LessonSlide, ChatMessage, TopicAnalysis, ExamFeedback, ExamQuestion } from "../types";

// Note: For Veo generation, we will re-instantiate the client to ensure we have the latest key if the user selected one.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to define the schema for a single slide to ensure consistent JSON output
const slideSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    content: { type: Type.STRING, description: "Educational content in markdown. Keep it concise (approx 100-150 words)." },
    imagePrompt: { 
      type: Type.STRING, 
      description: "A highly detailed description for an educational diagram, flowchart, or infographic that explains the concept. Do not include text in the prompt, but describe the visual elements clearly (e.g. 'A cross-section diagram of...', 'A flowchart showing...', 'An infographic comparing...')." 
    },
  },
  required: ["title", "content", "imagePrompt"],
};

/**
 * Starts a new dynamic lesson by generating the first slide.
 */
export const getInitialSlide = async (topic: string): Promise<LessonSlide> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert teacher. Create the introductory slide for a comprehensive lesson on "${topic}". 
      
      For the image prompt: Focus on creating a clear, educational diagram or illustration that helps visualize the concept.
      
      Return a single JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: slideSchema,
      },
    });

    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr) as LessonSlide;
  } catch (error) {
    console.error("Error generating initial slide:", error);
    throw new Error("Failed to start lesson.");
  }
};

/**
 * Generates the next slide based on the lesson history and recent chat.
 */
export const getNextSlide = async (
  topic: string, 
  previousSlideTitle: string, 
  lessonContext: string
): Promise<LessonSlide> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert teacher continuing a lesson.
      
      Current Main Focus: "${topic}"
      
      Lesson Context & Student Interests so far:
      ${lessonContext}
      
      The last slide was: "${previousSlideTitle}".
      
      Generate the NEXT logical slide. 
      - If the context indicates the student shifted topics, the next slide should seamlessly introduce that new topic.
      - If staying on topic, build upon the previous concept.
      - Ensure the image prompt requests a Diagram, Chart, or Infographic style visual.
      
      Return a single JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: slideSchema,
      },
    });

    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr) as LessonSlide;
  } catch (error) {
    console.error("Error generating next slide:", error);
    throw new Error("Failed to generate next slide.");
  }
};

/**
 * Summarizes the discussion that happened on a specific slide to maintain context.
 */
export const summarizeSlideDiscussion = async (
  slideTitle: string, 
  chatHistory: ChatMessage[]
): Promise<string> => {
  if (chatHistory.length === 0) return `Completed slide: ${slideTitle}.`;

  try {
    const chatText = chatHistory
      .map(msg => `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.text}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Summarize the key learning points and student interests from this discussion about "${slideTitle}".
      
      Discussion:
      ${chatText}
      
      Keep it brief (1-2 sentences). IMPORTANT: If the student asked about a different topic, note that specifically.`,
    });

    return response.text || `Discussed ${slideTitle}.`;
  } catch (error) {
    console.error("Error summarizing chat:", error);
    return `Discussed ${slideTitle}.`;
  }
};

/**
 * Child Agent: Researcher
 * Performs Google Search to find real-time info and sources.
 */
export const performResearch = async (query: string): Promise<{ text: string, sources: Array<{title: string, uri: string}> }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using standard model with tools
      contents: `Find detailed information about: "${query}". Provide a comprehensive summary.`,
      config: {
        tools: [{ googleSearch: {} }] // Enable Google Search Grounding
      }
    });

    const text = response.text || "No results found.";
    
    // Extract grounding chunks for sources
    const sources: Array<{title: string, uri: string}> = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach(chunk => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({ title: chunk.web.title, uri: chunk.web.uri });
      }
    });

    return { text, sources };
  } catch (error) {
    console.error("Research agent failed:", error);
    return { text: "I couldn't access the research tools at the moment.", sources: [] };
  }
};

/**
 * Analyzes a user message to determine if it belongs to the current topic or starts a new one.
 */
export const analyzeTopicShift = async (
  currentTopic: string,
  userMessage: string,
  recentHistory: ChatMessage[]
): Promise<TopicAnalysis> => {
  try {
    const historyContext = recentHistory.slice(-3).map(m => m.text).join(" | ");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Role: Topic Classifier.
      
      Context:
      - Current Official Topic: "${currentTopic}"
      - Recent Chat Snippet: ${historyContext}
      
      User's Latest Message: "${userMessage}"
      
      Task: Determine if the User's Latest Message is a COMPLETELY NEW subject unrelated to the Current Topic.
      
      Rules:
      1. If the user asks a follow-up, clarification, example, or specific detail about "${currentTopic}", it is NOT a new topic.
      2. If the user asks about a sub-topic (e.g., asking about "loops" while studying "Python"), it is NOT a new topic.
      3. If the user asks a generic question (e.g., "Why?", "Explain more"), it is NOT a new topic.
      4. Return true if the user switches to a distinct academic subject or different field (e.g. from "Quantum Physics" to "Machine Learning", or "History" to "Math").
      
      Return JSON only.
      - isNewTopic: boolean
      - topicName: string (If isNewTopic is true, provide the new topic name (2-4 words max). If false, return the Current Topic).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isNewTopic: { type: Type.BOOLEAN },
            topicName: { type: Type.STRING },
          },
          required: ["isNewTopic", "topicName"],
        },
      },
    });

    const jsonStr = response.text || '{"isNewTopic": false, "topicName": ""}';
    return JSON.parse(jsonStr) as TopicAnalysis;
  } catch (error) {
    console.error("Error analyzing topic shift:", error);
    return { isNewTopic: false, topicName: currentTopic };
  }
};

/**
 * Creates a chat session for the Parent Agent (Tutor).
 */
export const createTutorChat = (topic: string, previousHistory: ChatMessage[] = []): Chat => {
  const history: Content[] = previousHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: `You are MindSpark, a friendly and adaptive AI tutor.
      
      Your Architecture:
      You are the "Parent Agent". You have access to "Child Agents" (Researcher, Notebook, Visualizer) who provide you with data.
      
      Your Goal: 
      Teach the user about "${topic}". Synthesize information provided by your tools/children into a cohesive, educational response.
      
      Guidelines:
      1. Answer questions clearly and concisely.
      2. If you receive data from the [Research Agent], cite it naturally (e.g., "According to recent sources...").
      3. If you receive data from the [Notebook Agent], reference the user's notes (e.g., "Your notes mention that...").
      4. CRITICAL: If the user changes the topic, IMMEDIATELY pivot.
      5. Be conversational and encouraging.
      `
    }
  });
};

/**
 * Generates a visual representation (image) of the topic/slide.
 */
export const getConceptImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const enhancedPrompt = `${prompt}. 
    Style: Educational infographic, flat vector art, clean lines, white background, high contrast, technical illustration. 
    Ensure it looks like a diagram explaining the concept. No text in the image.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: enhancedPrompt,
      config: {
        imageConfig: {
          aspectRatio: "16:9", 
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return undefined;
  } catch (error) {
    console.error("Error generating image:", error);
    return undefined;
  }
};

export const getConceptExplanation = async (topic: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Explain the concept of "${topic}" clearly and concisely in markdown format.`,
    });
    return response.text ?? null;
  } catch (error) {
    console.error("Error generating explanation:", error);
    return null;
  }
};

/**
 * Generates a small set of study materials (Flashcards + Quiz).
 */
export const generateMicroStudySet = async (topicName: string, context: string) => {
  try {
    const [flashcardsRes, quizRes] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 3 study flashcards strictly based on this topic: "${topicName}" and context: "${context}".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { front: { type: Type.STRING }, back: { type: Type.STRING } },
              required: ["front", "back"],
            },
          },
        },
      }),
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 2 multiple choice quiz questions strictly based on this topic: "${topicName}" and context: "${context}".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswerIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ["question", "options", "correctAnswerIndex", "explanation"],
            },
          },
        },
      })
    ]);

    return {
      flashcards: JSON.parse(flashcardsRes.text || "[]") as Flashcard[],
      quiz: JSON.parse(quizRes.text || "[]") as QuizQuestion[]
    };
  } catch (error) {
    console.error("Error generating micro study set", error);
    return { flashcards: [], quiz: [] };
  }
};

export const getFlashcards = async (topic: string, context?: string): Promise<Flashcard[]> => {
  try {
    let prompt = `Generate 8 study flashcards for the topic "${topic}".`;
    if (context && context.trim().length > 0) {
      prompt = `Generate 8 study flashcards specifically based on the following material user has learned:
      
      LEARNING CONTEXT:
      ${context}
      
      Ensure the flashcards reinforce THESE specific concepts.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
            },
            required: ["front", "back"],
          },
        },
      },
    });

    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr) as Flashcard[];
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to generate flashcards.");
  }
};

export const getQuiz = async (topic: string, context?: string): Promise<QuizQuestion[]> => {
  try {
    let prompt = `Generate a 5-question multiple choice quiz for the topic "${topic}".`;
    if (context && context.trim().length > 0) {
      prompt = `Generate a 5-question multiple choice quiz based specifically on the following material the user has learned:
      
      LEARNING CONTEXT:
      ${context}
      
      Ensure questions test understanding of THESE specific details.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"],
          },
        },
      },
    });

    const jsonStr = response.text || "[]";
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz.");
  }
};

/**
 * Generates a mixed-format final exam (MCQ + Short Answer).
 */
export const generateExam = async (topic: string, context?: string): Promise<ExamQuestion[]> => {
  try {
    let prompt = `Create a difficult, comprehensive 7-question final exam for the subject "${topic}". 
      Format:
      - 5 Multiple Choice Questions (Type: "MCQ")
      - 2 Short Note/Essay Questions (Type: "SHORT_ANSWER")
      
      Questions should test deep understanding.`;
    
    if (context && context.trim().length > 0) {
      prompt = `Create a comprehensive 7-question final exam for the subject "${topic}".
      
      The exam MUST be based ONLY on the following material the user has studied:
      ${context}
      
      Requirements:
      1. Create 5 Multiple Choice Questions (type: "MCQ").
      2. Create 2 Short Note/Essay Questions (type: "SHORT_ANSWER").
      3. For Short Answer questions, provide a 'modelAnswer' field containing the key points or expected answer.
      4. Ensure questions are challenging and relevant to the context provided.
      `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["MCQ", "SHORT_ANSWER"] },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              modelAnswer: { type: Type.STRING, description: "Expected key points for short answer grading" }
            },
            required: ["id", "type", "question"],
          },
        },
      },
    });

    const jsonStr = response.text || "[]";
    // Generate simple IDs if missing
    const questions = JSON.parse(jsonStr) as ExamQuestion[];
    return questions.map((q, i) => ({ ...q, id: q.id || `q-${i}` }));
  } catch (error) {
    console.error("Error generating exam:", error);
    throw new Error("Failed to generate exam.");
  }
};

/**
 * Grades the exam using AI for short answers and logic for MCQs.
 */
export const gradeExam = async (
  topic: string, 
  questions: ExamQuestion[], 
  userAnswers: Record<string, string | number> // Key is question ID
): Promise<ExamFeedback> => {
  try {
    // Construct grading context
    const gradingPayload = questions.map(q => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'MCQ') {
        const selectedIdx = userAnswer as number;
        const isCorrect = selectedIdx === q.correctAnswerIndex;
        return {
          id: q.id,
          type: 'MCQ',
          question: q.question,
          correct: isCorrect,
          userSelected: q.options?.[selectedIdx] || "Skipped",
          correctOption: q.options?.[q.correctAnswerIndex || 0]
        };
      } else {
        return {
          id: q.id,
          type: 'SHORT_ANSWER',
          question: q.question,
          userText: userAnswer as string || "No answer provided",
          modelAnswer: q.modelAnswer
        };
      }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert professor grading a final exam on "${topic}".
      
      Here is the student's submission data:
      ${JSON.stringify(gradingPayload, null, 2)}
      
      Task:
      1. Calculate the final score.
         - For MCQs: 1 point if correct, 0 if wrong.
         - For SHORT_ANSWER: Rate from 0.0 to 1.0 based on how well the 'userText' matches the 'modelAnswer'.
      2. Provide specific feedback for EACH question explaining why it was right or wrong.
      3. Summarize overall strengths and weaknesses.
      4. Create a study plan.
      
      Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            totalQuestions: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            studyPlan: { type: Type.STRING },
            questionFeedback: { 
              type: Type.OBJECT, 
              description: "Map of Question Index (number) to Feedback String. E.g. { '0': 'Correct', '1': 'You missed...' }" 
            }
          },
          required: ["score", "strengths", "weaknesses", "studyPlan", "questionFeedback"],
        },
      },
    });

    const jsonStr = response.text || '{}';
    return JSON.parse(jsonStr) as ExamFeedback;
  } catch (error) {
    console.error("Error grading exam:", error);
    // Fallback
    return {
      score: 0,
      totalQuestions: questions.length,
      strengths: [],
      weaknesses: ["Grading system unavailable"],
      studyPlan: "Please try again later.",
      questionFeedback: {}
    };
  }
};

export const generateEducationalVideo = async (topic: string): Promise<string> => {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Educational video explanation of ${topic}. 
  Visual style: 3D animated diagram, clear motion graphics, slow smooth camera movement, high definition, scientific visualization.`;

  console.log("Starting video generation for:", topic);

  try {
    let operation = await dynamicAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await dynamicAi.operations.getVideosOperation({ operation: operation });
      console.log("Polling video status...");
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    return `${videoUri}&key=${process.env.API_KEY}`;
  } catch (error) {
    console.error("Video generation failed:", error);
    throw error;
  }
};
