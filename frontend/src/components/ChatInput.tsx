import { useState, useRef, useEffect, useCallback } from 'react';
import type { FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import type { Document } from '../types/document';
import { ArrowUp } from 'lucide-react';
import FileTypeBadge from './FileTypeBadge';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const filteredDocuments = mentionQuery
    ? documents.filter(doc =>
        doc.filename.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : documents;

  const autoGrow = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    setInput(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowAutocomplete(false);
    setMentionQuery('');
    setMentionStartPos(-1);
  };

  const handleSelectDocument = useCallback((doc: Document) => {
    if (mentionStartPos === -1) return;

    const beforeMention = input.substring(0, mentionStartPos);
    const afterMention = input.substring(mentionStartPos + mentionQuery.length + 1);
    const newInput = `${beforeMention}@${doc.filename}${afterMention}`;

    setInput(newInput);
    setShowAutocomplete(false);
    setMentionQuery('');
    setMentionStartPos(-1);

    onDocumentMention?.(doc.id);

    textareaRef.current?.focus();
  }, [input, mentionStartPos, mentionQuery, onDocumentMention]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete && filteredDocuments.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredDocuments.length - 1 ? prev + 1 : prev
          );
          return;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
          return;

        case 'Enter':
          e.preventDefault();
          handleSelectDocument(filteredDocuments[selectedIndex]);
          return;

        case 'Escape':
          e.preventDefault();
          setShowAutocomplete(false);
          setMentionQuery('');
          setMentionStartPos(-1);
          return;
      }
    }

    if (e.key === 'Enter' && e.shiftKey) {
      // Allow default behavior (newline insertion)
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const submitMessage = () => {
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
      setShowAutocomplete(false);
      setMentionQuery('');
      setMentionStartPos(-1);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitMessage();
  };

  useEffect(() => {
    autoGrow();
  }, [input, autoGrow]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
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

  return (
    <div style={{ padding: '10px 20px 14px' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredDocuments.length > 0 && (
          <div
            ref={autocompleteRef}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              width: '100%',
              maxWidth: 384,
              maxHeight: 240,
              overflowY: 'auto',
              background: 'var(--color-bg-elevated)',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 40,
              marginBottom: 4,
            }}
          >
            {filteredDocuments.map((doc, index) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => handleSelectDocument(doc)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  background: index === selectedIndex
                    ? 'rgba(91,138,245,0.1)'
                    : 'transparent',
                  borderLeft: index === selectedIndex
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileTypeBadge filename={doc.filename} className="flex-shrink-0" />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.filename}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Chat input form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-input, 14px)',
              padding: '8px 12px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <textarea
              ref={textareaRef}
              id="chat-input"
              name="chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message AIRA..."
              disabled={disabled}
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'none',
                maxHeight: 200,
                fontFamily: 'var(--font-family)',
                padding: 0,
                margin: 0,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-accent)',
              border: 'none',
              borderRadius: 8,
              cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: disabled || !input.trim() ? 0.5 : 1,
              padding: 0,
              flexShrink: 0,
              transition: 'opacity 0.15s ease, background 0.15s ease',
            }}
            aria-label="Send message"
          >
            <ArrowUp size={14} color="white" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
