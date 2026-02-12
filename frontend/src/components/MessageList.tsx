import { useEffect, useRef } from 'react';
import clsx from 'clsx';
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
    <h2 className="text-lg font-bold mt-4 mb-2" {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-base font-bold mt-3 mb-1.5" {...props} />
  ),
  p: ({ ...props }) => (
    <p className="mb-2 leading-relaxed" {...props} />
  ),
  ul: ({ ...props }) => (
    <ul className="ml-5 mb-2" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="ml-5 mb-2" {...props} />
  ),
  li: ({ ...props }) => (
    <li className="mb-1" {...props} />
  ),
  code: ({ inline, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => (
    inline ? (
      <code className="bg-gray-100 px-1 py-0.5 rounded text-[13px]" {...props} />
    ) : (
      <code className="block bg-gray-100 p-2 rounded text-[13px] overflow-x-auto whitespace-pre-wrap" {...props} />
    )
  ),
  strong: ({ ...props }) => (
    <strong className="font-bold" {...props} />
  ),
  hr: ({ ...props }) => (
    <hr className="border-t border-gray-200 my-4" {...props} />
  ),
  table: ({ ...props }) => (
    <table className="border-collapse w-full mb-2" {...props} />
  ),
  th: ({ ...props }) => (
    <th className="border border-gray-200 p-2 bg-gray-100 text-left" {...props} />
  ),
  td: ({ ...props }) => (
    <td className="border border-gray-200 p-2" {...props} />
  ),
  // Custom anchor handler to fix [Doc N] citation rendering
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => {
    // If href is undefined/empty, this is likely a [Doc N] reference-style link
    // that react-markdown couldn't resolve. Render as plain text instead.
    if (!href) {
      return <span className="font-semibold text-blue-600">[{children}]</span>;
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
      className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3"
    >
      {messages.map((message, index) => (
        <div
          key={index}
          className={clsx("max-w-[80%]", message.role === 'user' ? "self-end" : "self-start")}
        >
          <div className="text-xs font-bold mb-1 text-gray-500">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </div>
          <div
            className={clsx(
              "p-3 rounded-lg text-sm leading-relaxed text-gray-800 break-words",
              message.role === 'user' ? "bg-blue-50 whitespace-pre-wrap" : "bg-white"
            )}
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
        <div className="self-start max-w-[80%]">
          <div className="text-xs font-bold mb-1 text-gray-500">
            Assistant
          </div>
          <div
            className={clsx(
              "p-3 rounded-lg text-sm leading-relaxed break-words",
              streamingContent ? "text-gray-800 bg-white" : "text-gray-500 bg-white italic whitespace-pre-wrap"
            )}
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
