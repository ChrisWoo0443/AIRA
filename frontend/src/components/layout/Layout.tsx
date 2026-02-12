import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { SidebarToggle } from './SidebarToggle';
import { useSidebar } from '../../hooks/useSidebar';

interface LayoutProps {
  sidebarContent: ReactNode;
  children: ReactNode;
}

export function Layout({ sidebarContent, children }: LayoutProps) {
  const { isOpen, isFloating, toggle } = useSidebar();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar>{sidebarContent}</Sidebar>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar with toggle button */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <div
            className={clsx(
              // Always show on mobile, on desktop only show when floating
              isFloating ? "" : "md:hidden"
            )}
          >
            <SidebarToggle
              isOpen={isOpen}
              onClick={toggle}
            />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
