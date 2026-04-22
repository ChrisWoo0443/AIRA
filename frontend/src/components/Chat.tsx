import { useState, useRef, useCallback } from 'react'
import { PanelLeft } from 'lucide-react'
import type { ChatMessage } from '../types/chat'
import type { Document } from '../types/document'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { DocumentContextSelector } from './DocumentContextSelector'
import ModelSelector from './ModelSelector'
import { useChatSessions } from '../hooks/useChatSessions'
import { useSidebar } from '../hooks/useDocumentPanel'
import * as api from '../services/api'

interface ChatProps {
  selectedModel?: string
  onModelChange?: (model: string) => void
  documents: Document[]
}

export default function Chat({ selectedModel, onModelChange, documents }: ChatProps) {
  const { activeChat, updateMessages, updateTitle } = useChatSessions()
  const { toggle: toggleSidebar, isOpen: isSidebarOpen } = useSidebar()
  const messages = activeChat?.messages || []
  const sessionId = activeChat?.backendSessionId || null

  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set())
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showDocDropdown, setShowDocDropdown] = useState(false)

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

    const truncated = messages.slice(0, messageIndex)
    updateMessages(truncated)

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

  const modelDropdownNode = (
    <div style={{
      visibility: showModelDropdown ? 'visible' : 'hidden',
      opacity: showModelDropdown ? 1 : 0,
      transition: 'opacity 0.15s ease',
      pointerEvents: showModelDropdown ? 'auto' : 'none',
    }}>
      <ModelSelector
        onModelChange={(model) => {
          onModelChange?.(model)
        }}
        onClose={() => setShowModelDropdown(false)}
        isOpen={showModelDropdown}
      />
    </div>
  )

  const docDropdownNode = showDocDropdown ? (
    <DocumentContextSelector
      documents={documents}
      selectedIds={selectedDocumentIds}
      onToggle={handleToggleDocument}
      onToggleAll={handleToggleAllDocuments}
      onClose={() => setShowDocDropdown(false)}
      isOpen={showDocDropdown}
    />
  ) : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--color-bg-primary)',
      position: 'relative',
    }}>
      {/* Sidebar toggle button */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          cursor: 'pointer',
          padding: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        }}
      >
        <PanelLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
      </button>

      {/* Message list */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isLoading={isLoading}
        onRetry={handleRetry}
      />

      {/* Input area */}
      <ChatInput
        onSubmit={handleSubmit}
        disabled={isLoading}
        documents={documents}
        onDocumentMention={handleDocumentMention}
        selectedModel={selectedModel || ''}
        onModelClick={() => {
          setShowModelDropdown(prev => !prev)
          setShowDocDropdown(false)
        }}
        documentCount={documents.length}
        selectedDocumentCount={selectedDocumentIds.size}
        onDocumentContextClick={() => {
          setShowDocDropdown(prev => !prev)
          setShowModelDropdown(false)
        }}
        modelDropdown={modelDropdownNode}
        docDropdown={docDropdownNode}
      />
    </div>
  )
}
