import { Chat } from "@google/genai";
import { AgentMode, ChatMessage, TopicAnalysis } from "../types";
import { 
  analyzeTopicShift, 
  generateMicroStudySet, 
  performResearch 
} from "./geminiService";
import { topicDB } from "./TopicDatabase";

/**
 * The Agent Orchestrator manages the parent-child relationship between agents.
 * It routes the user's query to the appropriate child agent (Researcher, Notebook),
 * collects the result, and passes it to the Parent Agent (Tutor) for the final response.
 */
export class AgentOrchestrator {
  private parentChat: Chat | null = null;
  private currentTopicName: string;

  constructor(parentChat: Chat, initialTopic: string) {
    this.parentChat = parentChat;
    this.currentTopicName = initialTopic;
  }

  public updateParentChat(chat: Chat) {
    this.parentChat = chat;
  }

  public updateTopic(topic: string) {
    this.currentTopicName = topic;
  }

  /**
   * Main pipeline:
   * 1. Check Topic Shift
   * 2. Route to Child Agent (if not Standard Chat)
   * 3. Construct Parent Prompt
   * 4. Get Parent Response
   * 5. Trigger Background Generation
   */
  public async processUserQuery(
    userText: string,
    mode: AgentMode,
    recentHistory: ChatMessage[],
    slideContext: string
  ): Promise<{ response: ChatMessage, analysis: TopicAnalysis, sources?: Array<{title: string, uri: string}> }> {
    
    if (!this.parentChat) throw new Error("Parent Agent not initialized");

    // 1. Topic Detection (Always runs first)
    const analysis = await analyzeTopicShift(
      this.currentTopicName,
      userText,
      recentHistory
    );

    let workingTopicName = this.currentTopicName;
    let systemInjection = "";

    // Handle Topic Shift Logic
    if (analysis.isNewTopic && analysis.topicName !== this.currentTopicName) {
      workingTopicName = analysis.topicName;
      systemInjection += `[SYSTEM NOTE: The user has switched context to the topic "${workingTopicName}". Pivot your response to focus on this new topic immediately.]\n`;
      
      // Update internal state
      this.currentTopicName = workingTopicName;
    }

    // 2. Child Agent Routing
    let childAgentOutput = "";
    let sources: Array<{title: string, uri: string}> = [];

    if (mode === AgentMode.RESEARCH) {
      // Call Researcher Child Agent
      const researchResult = await performResearch(userText);
      childAgentOutput = `
      [DATA FROM RESEARCHER AGENT]:
      The user asked about "${userText}".
      Here are the search findings:
      ${researchResult.text}
      
      Instructions: Synthesize this research into a helpful response. Cite the sources provided.
      `;
      sources = researchResult.sources;
    } 
    else if (mode === AgentMode.NOTEBOOK) {
      // Call Notebook Child Agent (RAG Simulation)
      const currentTopic = topicDB.getCurrentTopic();
      const notebookContent = currentTopic?.notebookContent || "";
      
      if (notebookContent.trim()) {
        childAgentOutput = `
        [DATA FROM NOTEBOOK AGENT]:
        The user has provided the following personal notes/documents:
        """
        ${notebookContent.substring(0, 20000)} ... (content truncated for context)
        """
        
        Instructions: Answer the user's question "${userText}" strictly based on the provided notes above. If the answer isn't in the notes, say so.
        `;
      } else {
        childAgentOutput = `[DATA FROM NOTEBOOK AGENT]: The user has not uploaded any notes yet. Remind them to paste their content to use this feature.`;
      }
    }

    // 3. Construct Final Prompt for Parent Agent
    const finalPrompt = `
    ${systemInjection}
    [Current Slide Context: "${slideContext}"]
    ${childAgentOutput}
    
    User Query: ${userText}
    `;

    // 4. Get Response from Parent
    const result = await this.parentChat.sendMessage({ message: finalPrompt });
    const modelResponseText = result.text;

    const responseMessage: ChatMessage = {
      role: 'model',
      text: modelResponseText,
      sources: sources.length > 0 ? sources : undefined
    };

    // 5. Background Generation (Quiz/Flashcards) - Linked to Topic Detection
    // We fire and forget this so the UI doesn't block
    this.triggerBackgroundGeneration(workingTopicName, userText, modelResponseText);

    return {
      response: responseMessage,
      analysis,
      sources
    };
  }

  private async triggerBackgroundGeneration(topicName: string, userQ: string, modelA: string) {
    const currentTopic = topicDB.getCurrentTopic();
    if (!currentTopic) {
        // Create topic if it doesn't exist yet (based on analysis)
        const t = topicDB.createTopic(topicName);
        topicDB.setCurrentTopic(t.id);
    }
    
    const targetTopicId = topicDB.getCurrentTopic()?.id;
    if (targetTopicId) {
        const materials = await generateMicroStudySet(
            topicName,
            `User asked: ${userQ}. Model Answered: ${modelA}`
        );
        topicDB.addFlashcardsToTopic(targetTopicId, materials.flashcards);
        topicDB.addQuizQuestionsToTopic(targetTopicId, materials.quiz);
    }
  }
}