import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus } from 'lucide-react'
import type { ChatMessage } from '../types/chat'
import type { Document } from '../types/document'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { DocumentContextSelector } from './DocumentContextSelector'
import ModelSelector from './ModelSelector'
import { useLocalStorage } from '../hooks/useLocalStorage'
import * as api from '../services/api'

interface ChatProps {
  selectedModel?: string
  onModelChange?: (model: string) => void
  documents: Document[]
}

export default function Chat({ selectedModel, onModelChange, documents }: ChatProps) {
  const [sessionId, setSessionId, clearSessionId] = useLocalStorage<string | null>('research_agent_session_id', null)
  const [messages, setMessages, clearMessages] = useLocalStorage<ChatMessage[]>('research_agent_messages', [])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set())

  const streamingContentRef = useRef('')

  useEffect(() => {
    const initSession = async () => {
      if (sessionId) return

      try {
        const id = await api.createChatSession()
        setSessionId(id)
      } catch (error) {
        console.error('Failed to create session:', error)
      }
    }
    initSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleDocument = (id: string) => {
    setSelectedDocumentIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleToggleAllDocuments = () => {
    if (selectedDocumentIds.size === 0) {
      setSelectedDocumentIds(new Set(documents.map(doc => doc.id)))
    } else {
      setSelectedDocumentIds(new Set())
    }
  }

  const handleDocumentMention = (id: string) => {
    setSelectedDocumentIds(prev => {
      const newSet = new Set(prev)
      newSet.add(id)
      return newSet
    })
  }

  const handleSubmit = async (message: string) => {
    if (!message.trim() || !sessionId || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    setIsLoading(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    const documentIds = selectedDocumentIds.size > 0 ? Array.from(selectedDocumentIds) : undefined

    await api.sendChatMessage(
      message,
      sessionId,
      (chunk: string) => {
        streamingContentRef.current += chunk
        setStreamingContent(prev => prev + chunk)
      },
      () => {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: streamingContentRef.current,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
        setStreamingContent('')
        streamingContentRef.current = ''
        setIsLoading(false)
      },
      (error: string) => {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Error: ${error}`,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, errorMessage])
        setStreamingContent('')
        streamingContentRef.current = ''
        setIsLoading(false)
      },
      selectedModel,
      documentIds
    )
  }

  const handleRetry = useCallback(async (messageIndex: number) => {
    const userMessageIndex = messageIndex - 1
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') return
    const userContent = messages[userMessageIndex].content

    // Truncate: keep everything up to but not including the AI message
    const truncated = messages.slice(0, messageIndex)
    setMessages(truncated)

    // Stream new response without adding a new user message
    setIsLoading(true)
    setStreamingContent('')
    streamingContentRef.current = ''

    await api.sendChatMessage(
      userContent,
      sessionId!,
      (chunk) => {
        streamingContentRef.current += chunk
        setStreamingContent(streamingContentRef.current)
      },
      () => {
        setMessages(prev => [...prev, {
          role: 'assistant' as const,
          content: streamingContentRef.current,
          timestamp: new Date().toISOString()
        }])
        setStreamingContent('')
        setIsLoading(false)
      },
      (error) => { setIsLoading(false) },
      selectedModel || undefined,
      selectedDocumentIds.size > 0 ? Array.from(selectedDocumentIds) : undefined
    )
  }, [messages, sessionId, selectedModel, selectedDocumentIds])

  const handleNewConversation = async () => {
    try {
      if (sessionId) {
        api.deleteChatSession(sessionId).catch(err => {
          console.warn('Failed to delete session:', err)
        })
      }

      clearSessionId()
      clearMessages()

      setStreamingContent('')
      streamingContentRef.current = ''

      const id = await api.createChatSession()
      setSessionId(id)
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--color-bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 24px',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{
            color: 'var(--color-text-primary)',
            fontSize: 14,
            fontWeight: 600,
          }}>AIRA</span>
          <span style={{
            color: 'var(--color-text-tertiary)',
            fontSize: 11,
            marginLeft: 8,
          }}>AI Research Assistant</span>
        </div>

        {/* Right side */}
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}>
          {/* New Chat button */}
          <button
            onClick={handleNewConversation}
            disabled={isLoading}
            style={{
              color: 'var(--color-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              padding: 0,
            }}
            onMouseEnter={e => {
              if (!isLoading) e.currentTarget.style.color = 'var(--color-accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--color-text-tertiary)'
            }}
          >
            <Plus size={14} />
            New Chat
          </button>

          {/* Model Selector */}
          <ModelSelector onModelChange={onModelChange} />

          {/* Document count badge + DocumentContextSelector */}
          {documents.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 500,
              }}>
                {documents.length} docs
              </div>
              <DocumentContextSelector
                documents={documents}
                selectedIds={selectedDocumentIds}
                onToggle={handleToggleDocument}
                onToggleAll={handleToggleAllDocuments}
              />
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isLoading={isLoading}
        onRetry={handleRetry}
      />

      {/* Input area */}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'end',
        padding: 12,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-primary)',
      }}>
        <div style={{ flex: 1 }}>
          <ChatInput
            onSubmit={handleSubmit}
            disabled={isLoading}
            documents={documents}
            onDocumentMention={handleDocumentMention}
          />
        </div>
      </div>
    </div>
  )
}
