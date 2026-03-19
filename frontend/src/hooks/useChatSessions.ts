import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ChatSession } from '../types/chatSession'
import type { ChatMessage } from '../types/chat'
import { createChatSession, deleteChatSession } from '../services/api'

const CHATS_STORAGE_KEY = 'aira-chats'
const ACTIVE_CHAT_STORAGE_KEY = 'aira-active-chat'
const MAX_CHATS = 50

const OLD_SESSION_KEY = 'research_agent_session_id'
const OLD_MESSAGES_KEY = 'research_agent_messages'

interface ChatSessionsState {
  chats: ChatSession[]
  activeChatId: string | null
  activeChat: ChatSession | null
  createChat: () => Promise<void>
  switchChat: (chatId: string) => void
  deleteChat: (chatId: string) => Promise<void>
  updateMessages: (messages: ChatMessage[]) => void
  updateTitle: (title: string) => void
}

function generateId(): string {
  return crypto.randomUUID()
}

function loadStoredChats(): { chats: ChatSession[]; activeChatId: string | null; migrated: boolean } {
  try {
    // Check for old localStorage keys to migrate
    const oldSessionRaw = localStorage.getItem(OLD_SESSION_KEY)
    const oldMessagesRaw = localStorage.getItem(OLD_MESSAGES_KEY)

    if (oldSessionRaw) {
      const oldSessionId = JSON.parse(oldSessionRaw) as string
      const oldMessages = oldMessagesRaw ? (JSON.parse(oldMessagesRaw) as ChatMessage[]) : []

      // Remove old keys
      localStorage.removeItem(OLD_SESSION_KEY)
      localStorage.removeItem(OLD_MESSAGES_KEY)

      const now = new Date().toISOString()
      const migratedChat: ChatSession = {
        id: generateId(),
        title: 'New chat',
        messages: oldMessages,
        backendSessionId: oldSessionId,
        createdAt: now,
        updatedAt: now,
      }

      return { chats: [migratedChat], activeChatId: migratedChat.id, migrated: true }
    }

    // Load from new keys
    const storedChats = localStorage.getItem(CHATS_STORAGE_KEY)
    const storedActiveId = localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY)

    if (storedChats) {
      const chats = JSON.parse(storedChats) as ChatSession[]
      const activeChatId = storedActiveId ? JSON.parse(storedActiveId) as string : (chats[0]?.id ?? null)
      return { chats, activeChatId, migrated: false }
    }
  } catch {
    // Ignore parse errors, start fresh
  }

  return { chats: [], activeChatId: null, migrated: false }
}

export const ChatSessionsContext = createContext<ChatSessionsState | null>(null)

export function useChatSessionsState(): ChatSessionsState {
  const initialData = useRef(loadStoredChats())
  const [chats, setChats] = useState<ChatSession[]>(initialData.current.chats)
  const [activeChatId, setActiveChatId] = useState<string | null>(initialData.current.activeChatId)
  const initializedRef = useRef(false)

  // Persist chats to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats))
    } catch { /* ignore quota errors */ }
  }, [chats])

  // Persist active chat id to localStorage
  useEffect(() => {
    try {
      if (activeChatId) {
        localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, JSON.stringify(activeChatId))
      }
    } catch { /* ignore quota errors */ }
  }, [activeChatId])

  // Auto-create initial chat if empty
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (chats.length === 0) {
      createChatSession().then(backendSessionId => {
        const now = new Date().toISOString()
        const newChat: ChatSession = {
          id: generateId(),
          title: 'New chat',
          messages: [],
          backendSessionId,
          createdAt: now,
          updatedAt: now,
        }
        setChats([newChat])
        setActiveChatId(newChat.id)
      }).catch(() => {
        // If backend fails, create with empty session id
        const now = new Date().toISOString()
        const newChat: ChatSession = {
          id: generateId(),
          title: 'New chat',
          messages: [],
          backendSessionId: '',
          createdAt: now,
          updatedAt: now,
        }
        setChats([newChat])
        setActiveChatId(newChat.id)
      })
    }
  }, [chats.length])

  const activeChat = chats.find(chat => chat.id === activeChatId) ?? null

  const createChat = useCallback(async () => {
    const backendSessionId = await createChatSession()
    const now = new Date().toISOString()
    const newChat: ChatSession = {
      id: generateId(),
      title: 'New chat',
      messages: [],
      backendSessionId,
      createdAt: now,
      updatedAt: now,
    }

    setChats(previousChats => {
      const updated = [newChat, ...previousChats]
      // Evict oldest chats if over limit
      if (updated.length > MAX_CHATS) {
        return updated.slice(0, MAX_CHATS)
      }
      return updated
    })
    setActiveChatId(newChat.id)
  }, [])

  const switchChat = useCallback((chatId: string) => {
    setActiveChatId(chatId)
  }, [])

  const deleteChat = useCallback(async (chatId: string) => {
    const chatToDelete = chats.find(chat => chat.id === chatId)

    // Fire-and-forget backend deletion
    if (chatToDelete?.backendSessionId) {
      deleteChatSession(chatToDelete.backendSessionId).catch(() => {})
    }

    setChats(previousChats => {
      const remaining = previousChats.filter(chat => chat.id !== chatId)
      return remaining
    })

    // Switch to another chat if we deleted the active one
    if (activeChatId === chatId) {
      const remaining = chats.filter(chat => chat.id !== chatId)
      if (remaining.length > 0) {
        setActiveChatId(remaining[0].id)
      } else {
        // Create a new chat since we deleted the last one
        initializedRef.current = false
        setActiveChatId(null)
      }
    }
  }, [chats, activeChatId])

  const updateMessages = useCallback((messages: ChatMessage[]) => {
    setChats(previousChats =>
      previousChats.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages, updatedAt: new Date().toISOString() }
          : chat
      )
    )
  }, [activeChatId])

  const updateTitle = useCallback((title: string) => {
    setChats(previousChats =>
      previousChats.map(chat =>
        chat.id === activeChatId
          ? { ...chat, title }
          : chat
      )
    )
  }, [activeChatId])

  return {
    chats,
    activeChatId,
    activeChat,
    createChat,
    switchChat,
    deleteChat,
    updateMessages,
    updateTitle,
  }
}

export function useChatSessions(): ChatSessionsState {
  const context = useContext(ChatSessionsContext)
  if (!context) {
    throw new Error('useChatSessions must be used within a ChatSessionsProvider')
  }
  return context
}
