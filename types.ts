
export enum AppMode {
  IDLE = 'IDLE',
  LEARN = 'LEARN',       // Deep Dive (Chat, Slides, Video, Notebook)
  PRACTICE = 'PRACTICE', // Prep (Flashcards, Interactive Quiz)
  EXAM = 'EXAM',         // Test (Mock Exam, Grading)
}

export enum AgentMode {
  TUTOR = 'TUTOR',       // Standard Parent Agent
  RESEARCH = 'RESEARCH', // Researcher Child Agent
  NOTEBOOK = 'NOTEBOOK', // Notebook Child Agent
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export type QuestionType = 'MCQ' | 'SHORT_ANSWER';

export interface ExamQuestion {
  id: string;
  type: QuestionType;
  question: string;
  // For MCQ
  options?: string[]; 
  correctAnswerIndex?: number;
  // For Short Answer
  modelAnswer?: string; // The "correct" answer key points for the AI grader
}

export interface ExamResult {
  score: number;
  total: number;
  feedback: string;
}

export interface ExamFeedback {
  score: number;
  totalQuestions: number;
  strengths: string[];
  weaknesses: string[];
  studyPlan: string;
  questionFeedback: Record<number, string>; // Specific feedback per question index
}

export interface LessonSlide {
  title: string;
  content: string;
  imagePrompt: string;
  imageUrl?: string;
  imageLoading?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: Array<{ title: string; uri: string }>; // For Research Agent
}

export interface Topic {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  examQuestions: ExamQuestion[]; // Persisted exam
  isMainTopic: boolean;
  videoUri?: string;
  notebookContent?: string; // Text content for Notebook Agent
  knowledgeBase: string; // Accumulated summaries of what was actually learned/discussed
}

export interface TopicAnalysis {
  isNewTopic: boolean;
  topicName: string;
}

export interface SessionState {
  slides: LessonSlide[];
  currentSlideIndex: number;
  lessonContext: string;
  chatHistory: ChatMessage[];
  currentTopicName: string;
  agentMode: AgentMode;
}
