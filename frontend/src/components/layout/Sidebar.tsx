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
  const isFloating = isPeeking || (!isOpen && isPeeking);

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

      {/* Backdrop */}
      {visible && (
        <div
          className={clsx(
            'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
            // Mobile: always show when sidebar visible
            // Desktop: only show when peeking (floating)
            isPeeking ? 'opacity-100' : 'md:hidden'
          )}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'w-72 h-full bg-white border-r border-gray-200 flex-shrink-0',
          'transition-transform duration-300 ease-in-out',
          // Mobile: always fixed overlay
          'fixed top-0 left-0 z-50',
          // Desktop: static when open, fixed when peeking
          isOpen && !isPeeking && 'md:static',
          isFloating && 'md:fixed md:z-50',
          // Slide in/out
          visible ? 'translate-x-0' : '-translate-x-full'
        )}
        onMouseLeave={isPeeking ? handleSidebarLeave : undefined}
      >
        <div className="h-full overflow-y-auto p-4">
          <h1 className="text-lg font-semibold text-gray-800 mb-4">
            Research Agent
          </h1>
          {children}
        </div>
      </aside>
    </>
  );
}
