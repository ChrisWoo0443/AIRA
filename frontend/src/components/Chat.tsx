import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/chat';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import * as api from '../services/api';

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  // Ref to track accumulated streaming content (avoids stale closure in onComplete)
  const streamingContentRef = useRef('');

  useEffect(() => {
    const initSession = async () => {
      try {
        const id = await api.createChatSession();
        setSessionId(id);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };
    initSession();
  }, []);

  const handleSubmit = async (message: string) => {
    if (!message.trim() || !sessionId || isLoading) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Start streaming
    setIsLoading(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    await api.sendChatMessage(
      message,
      sessionId,
      // onChunk
      (chunk: string) => {
        streamingContentRef.current += chunk;
        setStreamingContent(prev => prev + chunk);
      },
      // onComplete
      () => {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: streamingContentRef.current,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
      },
      // onError
      (error: string) => {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Error: ${error}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
      }
    );
  };

  const handleNewConversation = async () => {
    try {
      const id = await api.createChatSession();
      setSessionId(id);
      setMessages([]);
      setStreamingContent('');
      streamingContentRef.current = '';
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '600px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid #ddd',
          backgroundColor: '#fff'
        }}
      >
        <h2 style={{ fontSize: '20px', margin: 0, color: '#333' }}>Chat</h2>
        <button
          onClick={handleNewConversation}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: isLoading ? '#ccc' : '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontWeight: 500
          }}
        >
          New Chat
        </button>
      </div>

      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isLoading={isLoading}
      />

      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </div>
  );
}
