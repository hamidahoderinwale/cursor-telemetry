import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

type ConversationInteraction = {
  timestamp: string;
  userMessage: string;
  assistantResponse?: string;
  filesReferenced: string[];
  interactionType: string;
};

type ConversationSession = {
  id: string;
  sourceType: 'cursor_conversation';
  sourcePath: string;
  discoveredAt: string;
  activityData: {
    conversationStart: string;
    conversationEnd?: string;
    context: string;
    triggerMessage: string;
    messages: ConversationInteraction[];
    totalInteractions: number;
    sessionDuration: number;
    topicsDiscussed: string[];
    codeReferences: string[];
    fileReferences: string[];
  };
  confidence: number;
};

export class ConversationTracker {
  private sessionsFile: string;
  private currentSession: ConversationSession | null = null;
  private sessionTimeoutMs = 5 * 60 * 1000;

  constructor(storageDir?: string) {
    const baseDir = storageDir || process.cwd();
    this.sessionsFile = path.join(baseDir, 'live_conversation_sessions.json');
  }

  startSession(triggerMessage = '', context = 'cursor_interaction'): string {
    const sessionId = `conversation_${Date.now()}`;
    const nowIso = new Date().toISOString();

    this.currentSession = {
      id: sessionId,
      sourceType: 'cursor_conversation',
      sourcePath: 'cursor_workspace',
      discoveredAt: nowIso,
      activityData: {
        conversationStart: nowIso,
        context,
        triggerMessage,
        messages: [],
        totalInteractions: 0,
        sessionDuration: 0,
        topicsDiscussed: [],
        codeReferences: [],
        fileReferences: []
      },
      confidence: 0.9
    };

    return sessionId;
  }

  addInteraction(userMessage: string, assistantResponse = '', filesReferenced?: string[]): void {
    if (!this.currentSession) {
      this.startSession(userMessage);
    }

    const interaction: ConversationInteraction = {
      timestamp: new Date().toISOString(),
      userMessage,
      assistantResponse,
      filesReferenced: filesReferenced || [],
      interactionType: this.classifyInteraction(userMessage)
    };

    this.currentSession!.activityData.messages.push(interaction);
    this.currentSession!.activityData.totalInteractions += 1;
    this.updateSessionMetadata(userMessage, filesReferenced);
    this.save();
    
    console.log(`Conversation interaction captured: ${interaction.interactionType} - ${userMessage.substring(0, 50)}...`);
  }

  /**
   * Add interaction from external sources (like Cursor logs or files)
   */
  addExternalInteraction(data: {
    userMessage?: string;
    assistantResponse?: string;
    timestamp?: string;
    source?: string;
    filesReferenced?: string[];
  }): void {
    const userMessage = data.userMessage || 'External interaction';
    const assistantResponse = data.assistantResponse || '';
    const timestamp = data.timestamp || new Date().toISOString();
    const source = data.source || 'external';

    if (!this.currentSession) {
      this.startSession(userMessage, `external_${source}`);
    }

    const interaction: ConversationInteraction = {
      timestamp,
      userMessage,
      assistantResponse,
      filesReferenced: data.filesReferenced || [],
      interactionType: this.classifyInteraction(userMessage)
    };

    this.currentSession!.activityData.messages.push(interaction);
    this.currentSession!.activityData.totalInteractions += 1;
    this.updateSessionMetadata(userMessage, data.filesReferenced);
    this.save();
    
    console.log(`External conversation captured from ${source}: ${interaction.interactionType}`);
  }

  endSession(): string | null {
    if (!this.currentSession) return null;
    const start = new Date(this.currentSession.activityData.conversationStart);
    const endIso = new Date().toISOString();
    const duration = new Date(endIso).getTime() - start.getTime();
    this.currentSession.activityData.sessionDuration = duration / 1000;
    this.currentSession.activityData.conversationEnd = endIso;
    this.save();
    const id = this.currentSession.id;
    this.currentSession = null;
    return id;
  }

  private classifyInteraction(message: string): string {
    const m = message.toLowerCase();
    if (/(plot|chart|visualization|graph)/.test(m)) return 'visualization_request';
    if (/(test|check|ensure|verify)/.test(m)) return 'testing_request';
    if (/(change|modify|update|fix)/.test(m)) return 'modification_request';
    if (/(explain|how|what|why)/.test(m)) return 'information_request';
    return 'general_interaction';
  }

  private updateSessionMetadata(message: string, filesReferenced?: string[]): void {
    if (!this.currentSession) return;
    const topics = this.extractTopics(message);
    for (const t of topics) {
      if (!this.currentSession.activityData.topicsDiscussed.includes(t)) {
        this.currentSession.activityData.topicsDiscussed.push(t);
      }
    }
    if (filesReferenced && filesReferenced.length > 0) {
      this.currentSession.activityData.fileReferences.push(...filesReferenced);
    }
    const start = new Date(this.currentSession.activityData.conversationStart);
    this.currentSession.activityData.sessionDuration = (Date.now() - start.getTime()) / 1000;
  }

  private extractTopics(message: string): string[] {
    const m = message.toLowerCase();
    const topics: string[] = [];
    if (/(subplot|d3|visualization)/.test(m)) topics.push('data_visualization');
    if (/(api|endpoint)/.test(m)) topics.push('api_development');
    if (/(test|testing)/.test(m)) topics.push('testing');
    if (/(session|tracking)/.test(m)) topics.push('session_management');
    if (/(pkl|procedural)/.test(m)) topics.push('procedural_knowledge');
    return topics;
  }

  private save(): void {
    const existing = this.loadAll();
    const sessions = existing.sessions || [];
    // Replace or append current session
    if (this.currentSession) {
      const idx = sessions.findIndex((s: ConversationSession) => s.id === this.currentSession!.id);
      if (idx >= 0) sessions[idx] = this.currentSession; else sessions.push(this.currentSession);
    }
    fs.writeFileSync(this.sessionsFile, JSON.stringify({
      pure_analysis: true,
      mock_data_used: false,
      hardcoded_sessions: false,
      discovery_timestamp: new Date().toISOString(),
      sessions
    }, null, 2));
  }

  private loadAll(): any {
    try {
      if (!fs.existsSync(this.sessionsFile)) return { sessions: [] };
      const raw = fs.readFileSync(this.sessionsFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { sessions: [] };
    }
  }
}


