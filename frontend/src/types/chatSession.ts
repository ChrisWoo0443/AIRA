import type { ChatMessage } from './chat'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  backendSessionId: string
  createdAt: string
  updatedAt: string
}
