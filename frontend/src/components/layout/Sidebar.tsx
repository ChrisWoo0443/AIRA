import { useRef, useCallback, type ReactNode } from 'react';
import clsx from 'clsx';
import { useSidebar } from '../../hooks/useSidebar';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const { isOpen, isPeeking, close, startPeek, stopPeek } = useSidebar();
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPeekTimeout = useCallback(() => {
    if (peekTimeoutRef.current) {
      clearTimeout(peekTimeoutRef.current);
      peekTimeoutRef.current = null;
    }
  }, []);

  const handlePeekZoneEnter = useCallback(() => {
    clearPeekTimeout();
    peekTimeoutRef.current = setTimeout(() => {
      startPeek();
    }, 300);
  }, [clearPeekTimeout, startPeek]);

  const handlePeekZoneLeave = useCallback(() => {
    clearPeekTimeout();
    if (isPeeking) {
      stopPeek();
    }
  }, [clearPeekTimeout, isPeeking, stopPeek]);

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

      {/* Sidebar — pinned mode (desktop open) */}
      {isOpen && (
        <aside className="hidden md:block w-72 h-full bg-white border-r border-gray-200 flex-shrink-0">
          <div className="h-full overflow-y-auto p-4">
            <h1 className="text-lg font-semibold text-gray-800 mb-4">
              Research Agent
            </h1>
            {children}
          </div>
        </aside>
      )}

      {/* Sidebar — mobile overlay */}
      <aside
        className={clsx(
          'md:hidden fixed top-0 left-0 z-50 w-72 h-full bg-white',
          'transition-transform duration-300 ease-in-out',
          visible ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          <h1 className="text-lg font-semibold text-gray-800 mb-4">
            Research Agent
          </h1>
          {children}
        </div>
      </aside>

      {/* Peek zone + floating sidebar (desktop only, when closed) */}
      {!isOpen && (
        <div
          className="hidden md:block fixed top-0 left-0 z-50 h-full pointer-events-none"
          onMouseLeave={handlePeekZoneLeave}
        >
          {/* Invisible trigger strip */}
          <div
            className="absolute top-0 left-0 w-3 h-full pointer-events-auto"
            onMouseEnter={!isPeeking ? handlePeekZoneEnter : undefined}
          />

          {/* Floating sidebar — always in DOM, slides in/out */}
          <aside
            className={clsx(
              'm-2 w-72 h-[calc(100%-16px)] bg-white rounded-xl shadow-2xl border border-gray-200',
              'transition-transform duration-300 ease-in-out',
              isPeeking ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
            )}
          >
            <div className="h-full overflow-y-auto p-4 rounded-xl">
              <h1 className="text-lg font-semibold text-gray-800 mb-4">
                Research Agent
              </h1>
              {children}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
