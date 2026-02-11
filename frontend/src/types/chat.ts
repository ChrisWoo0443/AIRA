export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string format for JSON serialization compatibility
}
