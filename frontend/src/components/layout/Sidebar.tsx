import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useSidebar } from '../../hooks/useSidebar';

interface SidebarProps {
  children: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const { isOpen, isFloating, close, toggleFloating } = useSidebar();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className={clsx(
            "fixed inset-0 bg-black/50 z-40",
            // On mobile: always show when sidebar is open
            // On desktop: only show when floating AND open
            "md:hidden",
            isFloating && "md:block"
          )}
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          // Base styles
          "w-72 h-full bg-white border-r border-gray-200",
          // Transition for smooth animation
          "transition-transform duration-300 ease-in-out",
          // Mobile: fixed positioning
          "fixed top-0 left-0 z-50",
          // Desktop: static by default, fixed when floating
          "md:static",
          isFloating && "md:fixed md:z-50",
          // Transform behavior
          // When closed: slide out
          !isOpen && "-translate-x-full",
          // When open on mobile: slide in
          isOpen && "translate-x-0",
          // Desktop non-floating: always visible (override transform)
          "md:translate-x-0",
          // Desktop floating AND closed: slide out
          isFloating && !isOpen && "md:-translate-x-full"
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          {/* Header with title and float toggle */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-800">
              Research Agent
            </h1>
            <button
              onClick={toggleFloating}
              className="hidden md:inline-flex px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              aria-label={isFloating ? 'Pin sidebar' : 'Float sidebar'}
            >
              {isFloating ? '📌 Pin' : '📍 Float'}
            </button>
          </div>

          {/* Sidebar content */}
          {children}
        </div>
      </aside>
    </>
  );
}
