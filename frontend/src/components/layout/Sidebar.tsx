import { useRef, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import { useSidebar } from '../../hooks/useSidebar';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const { isOpen, isPeeking, close, startPeek, stopPeek } = useSidebar();
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPeekTimeout = useCallback(() => {
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
      peekTimeoutRef.current = null;
    }
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleTriggerEnter = useCallback(() => {
    clearPeekTimeout();
    clearCloseTimeout();
    peekTimeoutRef.current = setTimeout(() => {
      startPeek();
    }, 300);
  }, [clearPeekTimeout, clearCloseTimeout, startPeek]);

  const handleTriggerLeave = useCallback(() => {
    clearPeekTimeout();
  }, [clearPeekTimeout]);

  const handleSidebarEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleSidebarLeave = useCallback(() => {
    if (isPeeking) {
      closeTimeoutRef.current = setTimeout(() => {
        stopPeek();
      }, 200);
    }
  }, [isPeeking, stopPeek]);

  const visible = isOpen || isPeeking;

  return (
    <>
      {/* Backdrop — mobile only */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Peek trigger strip — desktop only, when sidebar is closed */}
      {!isOpen && !isPeeking && (
        <div
          className="hidden md:block fixed top-0 left-0 w-3 h-full z-50"
          onMouseEnter={handleTriggerEnter}
          onMouseLeave={handleTriggerLeave}
        />
      )}

      {/* Single sidebar element — adapts style based on mode */}
      <aside
        className={clsx(
          'w-72 bg-white flex-shrink-0 z-50',
          'transition-transform duration-300 ease-in-out',
          // Mobile: always fixed overlay
          'fixed top-0 left-0 h-full',
          // Desktop pinned (open): static with border
          isOpen && 'md:static md:h-full md:border-r md:border-gray-200',
          // Desktop closed/peeking: floating card
          !isOpen && 'md:fixed md:top-2 md:left-2 md:h-[calc(100%-16px)] md:rounded-xl md:shadow-2xl md:border md:border-gray-200',
          // Slide in/out
          visible ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        )}
        onMouseEnter={isPeeking ? handleSidebarEnter : undefined}
        onMouseLeave={isPeeking ? handleSidebarLeave : undefined}
      >
        <div className={clsx(
          'h-full overflow-y-auto p-4',
          !isOpen && 'md:rounded-xl'
        )}>
          <h1 className="text-lg font-semibold text-gray-800 mb-4">
            Research Agent
          </h1>
          {children}
        </div>
      </aside>
    </>
  );
}
