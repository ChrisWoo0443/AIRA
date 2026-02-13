import { useState, useRef, useEffect } from 'react';
import { AiOutlineFileText } from 'react-icons/ai';
import clsx from 'clsx';
import type { Document } from '../types/document';
import { FileTypeIcon } from './FileTypeIcon';

interface DocumentContextSelectorProps {
  documents: Document[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

export function DocumentContextSelector({
  documents,
  selectedIds,
  onToggle,
  onToggleAll,
}: DocumentContextSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === 0; // empty = all documents by default

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
      >
        <AiOutlineFileText className="text-base" />
        <span>
          {allSelected ? 'All' : `${selectedCount} doc${selectedCount !== 1 ? 's' : ''}`}
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
          {/* Toggle all button */}
          <div className="pb-2 mb-2 border-b border-gray-200">
            <button
              type="button"
              onClick={onToggleAll}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* All documents indicator when none selected */}
          {allSelected && (
            <div className="px-2 py-1.5 mb-2 text-xs text-gray-500 italic">
              All documents (default)
            </div>
          )}

          {/* Document list */}
          <div className="max-h-52 overflow-y-auto">
            {documents.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-400 text-center">
                No documents uploaded
              </div>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedIds.has(doc.id);

                return (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(doc.id)}
                      className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 cursor-pointer"
                    />
                    <FileTypeIcon filename={doc.filename} className="flex-shrink-0" />
                    <span className="flex-1 text-xs text-gray-800 truncate">
                      {doc.filename}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
