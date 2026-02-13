import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import type { Document } from '../types/document';
import { FileTypeIcon } from './FileTypeIcon';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled: boolean;
  documents?: Document[];
  onDocumentMention?: (id: string) => void;
}

export function ChatInput({ onSubmit, disabled, documents = [], onDocumentMention }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Filter documents based on mention query
  const filteredDocuments = mentionQuery
    ? documents.filter(doc =>
        doc.filename.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : documents;

  // Detect @ mention
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInput(value);

    // Find the last @ before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's no space between @ and cursor (valid mention)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
    }

    // Hide autocomplete if no valid mention
    setShowAutocomplete(false);
    setMentionQuery('');
    setMentionStartPos(-1);
  };

  // Handle document selection from autocomplete
  const handleSelectDocument = (doc: Document) => {
    if (mentionStartPos === -1) return;

    // Replace @query with @filename
    const beforeMention = input.substring(0, mentionStartPos);
    const afterMention = input.substring(mentionStartPos + mentionQuery.length + 1);
    const newInput = `${beforeMention}@${doc.filename}${afterMention}`;

    setInput(newInput);
    setShowAutocomplete(false);
    setMentionQuery('');
    setMentionStartPos(-1);

    // Call the mention callback to add document to context
    onDocumentMention?.(doc.id);

    // Focus back to input
    inputRef.current?.focus();
  };

  // Keyboard navigation for autocomplete
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete || filteredDocuments.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredDocuments.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;

      case 'Enter':
        if (showAutocomplete) {
          e.preventDefault();
          handleSelectDocument(filteredDocuments[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        setMentionQuery('');
        setMentionStartPos(-1);
        break;
    }
  };

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    if (showAutocomplete) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutocomplete]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
      setShowAutocomplete(false);
      setMentionQuery('');
      setMentionStartPos(-1);
    }
  };

  return (
    <div className="relative w-full">
      {/* Autocomplete dropdown */}
      {showAutocomplete && filteredDocuments.length > 0 && (
        <div
          ref={autocompleteRef}
          className="absolute bottom-full left-0 mb-1 w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-20"
        >
          {filteredDocuments.map((doc, index) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleSelectDocument(doc)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                index === selectedIndex
                  ? 'bg-blue-50 text-gray-900'
                  : 'text-gray-800 hover:bg-gray-100'
              )}
            >
              <FileTypeIcon filename={doc.filename} className="flex-shrink-0" />
              <span className="flex-1 truncate">{doc.filename}</span>
            </button>
          ))}
        </div>
      )}

      {/* Chat input form */}
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          id="chat-input"
          name="chat-input"
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
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
    </div>
  );
}
