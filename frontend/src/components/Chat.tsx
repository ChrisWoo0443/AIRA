import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { ChatMessage } from '../types/chat';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { useLocalStorage } from '../hooks/useLocalStorage';
import * as api from '../services/api';

interface ChatProps {
  selectedModel?: string;
}

export function Chat({ selectedModel }: ChatProps) {
  const [sessionId, setSessionId, clearSessionId] = useLocalStorage<string | null>('research_agent_session_id', null);
  const [messages, setMessages, clearMessages] = useLocalStorage<ChatMessage[]>('research_agent_messages', []);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Ref to track accumulated streaming content (avoids stale closure in onComplete)
  const streamingContentRef = useRef('');

  useEffect(() => {
    const initSession = async () => {
      // If sessionId already exists in localStorage (from previous session), use it
      if (sessionId) {
        return;
      }

      // Otherwise, create a new session
      try {
        const id = await api.createChatSession();
        setSessionId(id);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };
    initSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (message: string) => {
    if (!message.trim() || !sessionId || isLoading) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
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
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
        setStreamingContent('');
        streamingContentRef.current = '';
        setIsLoading(false);
      },
      selectedModel
    );
  };

  const handleNewConversation = async () => {
    try {
      // Delete the backend session (fire-and-forget for instant UI)
      if (sessionId) {
        api.deleteChatSession(sessionId).catch(err => {
          console.warn('Failed to delete session:', err);
        });
      }

      // Clear localStorage
      clearSessionId();
      clearMessages();

      // Reset streaming state
      setStreamingContent('');
      streamingContentRef.current = '';

      // Create a new session
      const id = await api.createChatSession();
      setSessionId(id);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl text-gray-800 m-0">Chat</h2>
        <button
          onClick={handleNewConversation}
          disabled={isLoading}
          className={clsx(
            "px-3 py-1.5 text-sm font-medium text-white rounded border-none",
            isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-gray-600 cursor-pointer hover:bg-gray-700"
          )}
        >
          Clear History
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
