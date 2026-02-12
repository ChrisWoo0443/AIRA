import { useState } from 'react';
import clsx from 'clsx';
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
    <form className="flex gap-2 p-3 border-t border-gray-200 bg-white" onSubmit={handleSubmit}>
      <input
        id="chat-input"
        name="chat-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a question about your documents..."
        disabled={disabled}
        className={clsx(
          "flex-1 px-3 py-2 text-sm font-sans border border-gray-200 rounded outline-none",
          disabled ? "bg-gray-100 text-gray-400" : "bg-white text-gray-800"
        )}
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        className={clsx(
          "px-4 py-2 text-sm font-sans font-medium text-white rounded border-none",
          (disabled || !input.trim()) ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 cursor-pointer hover:bg-blue-700"
        )}
      >
        Send
      </button>
    </form>
  );
}
