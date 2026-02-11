import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
}

// Shared markdown component configuration
const markdownComponents = {
  h2: ({ ...props }) => (
    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }} {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', marginBottom: '6px' }} {...props} />
  ),
  p: ({ ...props }) => (
    <p style={{ marginBottom: '8px', lineHeight: '1.6' }} {...props} />
  ),
  ul: ({ ...props }) => (
    <ul style={{ marginLeft: '20px', marginBottom: '8px' }} {...props} />
  ),
  ol: ({ ...props }) => (
    <ol style={{ marginLeft: '20px', marginBottom: '8px' }} {...props} />
  ),
  li: ({ ...props }) => (
    <li style={{ marginBottom: '4px' }} {...props} />
  ),
  code: ({ inline, ...props }: { inline?: boolean; [key: string]: unknown }) => (
    inline ? (
      <code style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '3px', fontSize: '13px' }} {...props} />
    ) : (
      <code style={{ display: 'block', backgroundColor: '#f0f0f0', padding: '8px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap' }} {...props} />
    )
  ),
  strong: ({ ...props }) => (
    <strong style={{ fontWeight: 'bold' }} {...props} />
  ),
  hr: ({ ...props }) => (
    <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '16px 0' }} {...props} />
  ),
  table: ({ ...props }) => (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '8px' }} {...props} />
  ),
  th: ({ ...props }) => (
    <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'left' }} {...props} />
  ),
  td: ({ ...props }) => (
    <td style={{ border: '1px solid #ddd', padding: '8px' }} {...props} />
  ),
  // Custom anchor handler to fix [Doc N] citation rendering
  a: ({ href, children, ...props }: { href?: string; children?: React.ReactNode; [key: string]: unknown }) => {
    // If href is undefined/empty, this is likely a [Doc N] reference-style link
    // that react-markdown couldn't resolve. Render as plain text instead.
    if (!href) {
      return <span style={{ fontWeight: 600, color: '#1a73e8' }}>[{children}]</span>;
    }
    return <a href={href} {...props}>{children}</a>;
  }
};

export function MessageList({ messages, streamingContent, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smart auto-scroll: only scroll if user is near bottom
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {messages.map((message, index) => (
        <div
          key={index}
          style={{
            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%'
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '4px',
              color: '#666'
            }}
          >
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#fff',
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#333',
              whiteSpace: message.role === 'user' ? 'pre-wrap' : undefined,
              wordBreak: 'break-word'
            }}
          >
            {message.role === 'user' ? (
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
        </div>
      ))}

      {isLoading && (
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: '80%'
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '4px',
              color: '#666'
            }}
          >
            Assistant
          </div>
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#fff',
              fontSize: '14px',
              lineHeight: '1.5',
              color: streamingContent ? '#333' : '#666',
              whiteSpace: streamingContent ? undefined : 'pre-wrap',
              wordBreak: 'break-word',
              fontStyle: streamingContent ? 'normal' : 'italic'
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
              'Thinking...'
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
