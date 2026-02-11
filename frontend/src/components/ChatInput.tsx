import { useState } from 'react';
import type { FormEvent } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px',
        borderTop: '1px solid #ddd',
        backgroundColor: '#fff'
      }}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a question about your documents..."
        disabled={disabled}
        style={{
          flex: 1,
          padding: '8px 12px',
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          border: '1px solid #ddd',
          borderRadius: '4px',
          outline: 'none',
          backgroundColor: disabled ? '#f5f5f5' : '#fff',
          color: disabled ? '#999' : '#333'
        }}
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: (disabled || !input.trim()) ? '#ccc' : '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: (disabled || !input.trim()) ? 'not-allowed' : 'pointer',
          fontWeight: 500
        }}
      >
        Send
      </button>
    </form>
  );
}
