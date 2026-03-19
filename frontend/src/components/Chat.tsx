import { useState, useRef, useCallback } from 'react'
import type { ChatMessage } from '../types/chat'
import type { Document } from '../types/document'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { DocumentContextSelector } from './DocumentContextSelector'
import ModelSelector from './ModelSelector'
import { useChatSessions } from '../hooks/useChatSessions'
import * as api from '../services/api'

interface ChatProps {
  selectedModel?: string
  onModelChange?: (model: string) => void
  documents: Document[]
}

export default function Chat({ selectedModel, onModelChange, documents }: ChatProps) {
  const { activeChat, updateMessages, updateTitle } = useChatSessions()
  const messages = activeChat?.messages || []
  const sessionId = activeChat?.backendSessionId || null

  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set())

  const streamingContentRef = useRef('')

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
    updateMessages([...messages, userMessage])

    if (activeChat?.title === 'New chat') {
      const truncated = message.length > 40
        ? message.slice(0, 40).replace(/\s+\S*$/, '') + '...'
        : message
      updateTitle(truncated)
    }

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
        updateMessages([...messages, userMessage, assistantMessage])
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
        updateMessages([...messages, userMessage, errorMessage])
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
    updateMessages(truncated)

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
        updateMessages([...truncated, {
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
  }, [messages, sessionId, selectedModel, selectedDocumentIds, updateMessages])

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
        padding: '10px 20px',
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
          {/* Model Selector */}
          <ModelSelector onModelChange={onModelChange} />

          {/* Document count badge + DocumentContextSelector */}
          {documents.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 11,
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
