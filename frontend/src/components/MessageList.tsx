import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  isLoading: boolean;
}

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
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {message.content}
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
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontStyle: streamingContent ? 'normal' : 'italic'
            }}
          >
            {streamingContent || 'Thinking...'}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
