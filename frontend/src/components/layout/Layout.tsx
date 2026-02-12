import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SidebarToggle } from './SidebarToggle';
import { SidebarContext, useSidebarState, useSidebar } from '../../hooks/useSidebar';

interface LayoutProps {
  sidebarContent: ReactNode;
  children: ReactNode;
}

function LayoutInner({ sidebarContent, children }: LayoutProps) {
  const { isOpen, toggle } = useSidebar();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar>{sidebarContent}</Sidebar>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <SidebarToggle isOpen={isOpen} onClick={toggle} />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function Layout(props: LayoutProps) {
  const sidebarState = useSidebarState();

  return (
    <SidebarContext.Provider value={sidebarState}>
      <LayoutInner {...props} />
    </SidebarContext.Provider>
  );
}
