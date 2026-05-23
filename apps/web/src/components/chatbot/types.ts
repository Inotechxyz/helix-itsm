export interface ChatMessage {
  id: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'rich' | 'quick_reply' | 'card';
  intent?: string;
  references?: ChatReference[];
  userFeedback?: {
    helpful: boolean;
    comment?: string;
  };
  createdAt: Date | string;
}

export interface ChatReference {
  type: 'article' | 'ticket' | 'service' | 'service_request';
  id: string;
  title: string;
  url?: string;
}

export interface ChatSession {
  id: string;
  sessionId: string;
  status: 'active' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed';
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  messageCount: number;
  createdAt: Date | string;
  lastMessageAt?: Date | string;
  messages?: ChatMessage[];
}

export interface ChatbotConfig {
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
  chatbotName: string;
  greetingMessage: string;
  systemPrompt?: string;
  autoEscalateAfter: number;
  escalateKeywords: string[];
  customFaqs?: { question: string; answer: string }[];
}

export interface QuickReply {
  label: string;
  value: string;
}