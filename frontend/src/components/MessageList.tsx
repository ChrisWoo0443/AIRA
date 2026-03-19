import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChatMessage } from '../types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, RotateCcw } from 'lucide-react'

interface MessageListProps {
  messages: ChatMessage[]
  streamingContent: string
  isLoading: boolean
  onRetry?: (messageIndex: number) => void
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [content])

  return (
    <button
      title="Copy"
      onClick={handleCopy}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {copied ? (
        <Check size={14} style={{ color: 'var(--color-status-success)' }} />
      ) : (
        <Copy size={14} style={{ color: 'var(--color-text-tertiary)' }} />
      )}
    </button>
  )
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      title="Retry"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RotateCcw size={14} style={{ color: 'var(--color-text-tertiary)' }} />
    </button>
  )
}

function MessageActions({
  content,
  showRetry,
  onRetry,
}: {
  content: string
  showRetry: boolean
  onRetry?: () => void
}) {
  return (
    <div
      className="message-actions"
      style={{
        position: 'absolute',
        top: -8,
        right: -8,
        display: 'flex',
        gap: 2,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: '2px 4px',
        opacity: 0,
        transition: 'opacity 0.15s',
      }}
    >
      <CopyButton content={content} />
      {showRetry && onRetry && <RetryButton onClick={onRetry} />}
    </div>
  )
}

function LinkRenderer({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  if (!href) {
    return (
      <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
        [{children}]
      </span>
    )
  }

  return (
    <a
      href={href}
      style={{
        color: 'var(--color-accent)',
        textDecoration: hovered ? 'underline' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </a>
  )
}

const markdownComponents = {
  h2: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 16, marginBottom: 8 }} {...props} />
  ),
  h3: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 6 }} {...props} />
  ),
  p: ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p style={{ marginBottom: 8, lineHeight: 1.6 }} {...props} />
  ),
  ul: ({ ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul style={{ marginLeft: 20, marginBottom: 8 }} {...props} />
  ),
  ol: ({ ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol style={{ marginLeft: 20, marginBottom: 8 }} {...props} />
  ),
  li: ({ ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li style={{ marginBottom: 4 }} {...props} />
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    if (match) {
      return (
        <div
          style={{
            background: 'var(--color-bg-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            overflow: 'auto',
          }}
        >
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: 0,
              background: 'transparent',
              fontSize: 13,
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      )
    }

    return (
      <code
        style={{
          background: 'var(--color-bg-input)',
          color: 'var(--color-accent)',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 13,
        }}
        {...props}
      >
        {children}
      </code>
    )
  },
  strong: ({ ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong style={{ fontWeight: 700 }} {...props} />
  ),
  hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--color-border)',
        margin: '16px 0',
      }}
      {...props}
    />
  ),
  table: ({ ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 8 }} {...props} />
  ),
  th: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      style={{
        border: '1px solid var(--color-border)',
        padding: 8,
        background: 'var(--color-bg-input)',
        textAlign: 'left',
      }}
      {...props}
    />
  ),
  td: ({ ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td style={{ border: '1px solid var(--color-border)', padding: 8 }} {...props} />
  ),
  a: LinkRenderer,
}

const hoverStyleTag = `
.message-wrapper:hover .message-actions {
  opacity: 1 !important;
}
@keyframes pulse-thinking {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`

export function MessageList({
  messages,
  streamingContent,
  isLoading,
  onRetry,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100

    if (isNearBottom) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, streamingContent])

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  })()

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <style>{hoverStyleTag}</style>

      {isEmpty && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              color: 'var(--color-text-tertiary)',
              fontSize: 15,
            }}
          >
            Start a conversation
          </span>
          <span
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
            }}
          >
            Upload documents and ask questions about them
          </span>
        </div>
      )}

      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const isAssistant = message.role === 'assistant'
        const isLastAssistant = index === lastAssistantIndex

        return (
          <div
            key={index}
            className="message-wrapper"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              position: 'relative',
            }}
          >
            {/* Header: avatar + label + timestamp */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}
            >
              {isAssistant && (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #5b8af5, #a78bfa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    A
                  </span>
                </div>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isUser
                    ? 'var(--color-accent)'
                    : 'var(--color-text-secondary)',
                }}
              >
                {isUser ? 'You' : 'AIRA'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* Message body */}
            <div style={{ position: 'relative', maxWidth: '80%' }}>
              <div
                style={
                  isUser
                    ? {
                        background: 'linear-gradient(135deg, #5b8af5, #4a7ae8)',
                        borderRadius: '12px 4px 12px 12px',
                        color: 'white',
                        fontSize: 13,
                        lineHeight: 1.6,
                        padding: '10px 14px',
                        whiteSpace: 'pre-wrap' as const,
                        wordBreak: 'break-word' as const,
                        marginLeft: 'auto',
                      }
                    : {
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border-rail)',
                        borderRadius: '4px 12px 12px 12px',
                        color: 'var(--color-text-primary)',
                        fontSize: 13,
                        lineHeight: 1.6,
                        padding: '10px 14px',
                        wordBreak: 'break-word' as const,
                      }
                }
              >
                {isUser ? (
                  message.content
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>

              <MessageActions
                content={message.content}
                showRetry={isLastAssistant}
                onRetry={
                  isLastAssistant && onRetry
                    ? () => onRetry(index)
                    : undefined
                }
              />
            </div>
          </div>
        )
      })}

      {isLoading && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #5b8af5, #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                A
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
              }}
            >
              AIRA
            </span>
          </div>

          <div
            style={{
              maxWidth: '80%',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-rail)',
              borderRadius: '4px 12px 12px 12px',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.6,
              wordBreak: 'break-word' as const,
              color: 'var(--color-text-primary)',
            }}
          >
            {streamingContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {streamingContent}
              </ReactMarkdown>
            ) : (
              <span
                style={{
                  fontStyle: 'italic',
                  color: 'var(--color-text-tertiary)',
                  animation: 'pulse-thinking 1.5s ease-in-out infinite',
                }}
              >
                Thinking...
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

export default MessageList
