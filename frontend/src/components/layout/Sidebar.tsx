import { useRef, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import { useSidebar } from '../../hooks/useSidebar';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const { isOpen, isPeeking, close, startPeek, stopPeek } = useSidebar();
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverZoneEnter = useCallback(() => {
    peekTimeoutRef.current = setTimeout(() => {
      startPeek();
    }, 300);
  }, [startPeek]);

  const handleHoverZoneLeave = useCallback(() => {
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
      peekTimeoutRef.current = null;
    }
  }, []);

  const handleSidebarLeave = useCallback(() => {
    stopPeek();
  }, [stopPeek]);

  const visible = isOpen || isPeeking;

  return (
    <>
      {/* Hover zone — only when sidebar is closed on desktop */}
      {!isOpen && !isPeeking && (
        <div
          className="hidden md:block fixed top-0 left-0 w-3 h-full z-40"
          onMouseEnter={handleHoverZoneEnter}
          onMouseLeave={handleHoverZoneLeave}
        />
      )}

      {/* Backdrop — mobile only */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-white flex-shrink-0',
          'transition-transform duration-300 ease-in-out',
          // Mobile: full-height fixed overlay
          'fixed top-0 left-0 z-50 w-72 h-full',
          // Desktop pinned: static, full height, border right
          isOpen && !isPeeking && 'md:static md:border-r md:border-gray-200',
          // Desktop peeking: floating card with gap, rounded, shadow
          isPeeking && 'md:top-2 md:left-2 md:h-[calc(100%-16px)] md:rounded-xl md:shadow-2xl md:border md:border-gray-200',
          // Slide in/out
          visible ? 'translate-x-0' : '-translate-x-full'
        )}
        onMouseLeave={isPeeking ? handleSidebarLeave : undefined}
      >
        <div className={clsx(
          'h-full overflow-y-auto p-4',
          isPeeking && 'md:rounded-xl'
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
