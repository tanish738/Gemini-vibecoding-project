
import { Topic, Flashcard, QuizQuestion, ChatMessage, SessionState, ExamQuestion } from "../types";

/**
 * Singleton "Database" to manage topics, conversation history, and generated materials.
 * Uses OOP principles to encapsulate state management.
 */
class TopicDatabase {
  private static instance: TopicDatabase;
  private topics: Map<string, Topic>;
  private currentTopicId: string | null;
  private mainTopicName: string | null;
  private sessionState: SessionState | null;

  private constructor() {
    this.topics = new Map();
    this.currentTopicId = null;
    this.mainTopicName = null;
    this.sessionState = null;
  }

  public static getInstance(): TopicDatabase {
    if (!TopicDatabase.instance) {
      TopicDatabase.instance = new TopicDatabase();
    }
    return TopicDatabase.instance;
  }

  /**
   * Resets the database for a completely new session
   */
  public reset(mainTopicName: string) {
    this.topics.clear();
    this.mainTopicName = mainTopicName;
    this.sessionState = null;
    const mainTopic = this.createTopic(mainTopicName, true);
    this.currentTopicId = mainTopic.id;
  }

  public getMainTopicName(): string | null {
    return this.mainTopicName;
  }

  public setSessionState(state: SessionState) {
    this.sessionState = state;
  }

  public getSessionState(): SessionState | null {
    return this.sessionState;
  }

  public createTopic(name: string, isMain: boolean = false): Topic {
    // Check if topic exists loosely
    const existing = Array.from(this.topics.values()).find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing;

    const id = crypto.randomUUID();
    const newTopic: Topic = {
      id,
      name,
      timestamp: Date.now(),
      messages: [],
      flashcards: [],
      quizzes: [],
      examQuestions: [],
      isMainTopic: isMain,
      notebookContent: "",
      knowledgeBase: "" 
    };
    
    this.topics.set(id, newTopic);
    return newTopic;
  }

  public setCurrentTopic(topicId: string) {
    if (this.topics.has(topicId)) {
      this.currentTopicId = topicId;
    }
  }

  public getCurrentTopic(): Topic | undefined {
    if (!this.currentTopicId) return undefined;
    return this.topics.get(this.currentTopicId);
  }

  public getTopicByName(name: string): Topic | undefined {
    return Array.from(this.topics.values()).find(t => t.name.toLowerCase() === name.toLowerCase());
  }

  public getAllTopics(): Topic[] {
    return Array.from(this.topics.values()).sort((a, b) => {
      // Main topic first, then by timestamp
      if (a.isMainTopic) return -1;
      if (b.isMainTopic) return 1;
      return a.timestamp - b.timestamp;
    });
  }

  public addMessageToTopic(topicId: string, message: ChatMessage) {
    const topic = this.topics.get(topicId);
    if (topic) {
      topic.messages.push(message);
    }
  }

  public appendKnowledge(topicId: string, summary: string) {
    const topic = this.topics.get(topicId);
    if (topic) {
      // Append with a separator
      topic.knowledgeBase += `\n- ${summary}`;
    }
  }

  public getKnowledgeBase(topicId: string): string {
    return this.topics.get(topicId)?.knowledgeBase || "";
  }

  public addFlashcardsToTopic(topicId: string, cards: Flashcard[]) {
    const topic = this.topics.get(topicId);
    if (topic) {
      // Add to queue (append)
      topic.flashcards.push(...cards);
    }
  }

  public addQuizQuestionsToTopic(topicId: string, questions: QuizQuestion[]) {
    const topic = this.topics.get(topicId);
    if (topic) {
      // Add to queue (append)
      topic.quizzes.push(...questions);
    }
  }

  public setExamQuestionsForTopic(topicId: string, questions: ExamQuestion[]) {
    const topic = this.topics.get(topicId);
    if (topic) {
      topic.examQuestions = questions;
    }
  }

  public getExamQuestionsForTopic(topicId: string): ExamQuestion[] {
    return this.topics.get(topicId)?.examQuestions || [];
  }

  public updateNotebookContent(topicId: string, content: string) {
    const topic = this.topics.get(topicId);
    if (topic) {
      topic.notebookContent = content;
    }
  }

  public getTopicContent(topicId: string) {
    const topic = this.topics.get(topicId);
    return {
      flashcards: topic?.flashcards || [],
      quizzes: topic?.quizzes || [],
      examQuestions: topic?.examQuestions || [],
      notebookContent: topic?.notebookContent || "",
      knowledgeBase: topic?.knowledgeBase || ""
    };
  }
}

export const topicDB = TopicDatabase.getInstance();
