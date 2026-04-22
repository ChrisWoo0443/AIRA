import { type ReactNode } from 'react'
import { SidebarContext, useSidebarState } from '../../hooks/useDocumentPanel'
import { Sidebar } from './DocumentPanel'

interface LayoutProps {
  chatListContent: ReactNode
  documentContent: ReactNode
  children: ReactNode
}

export function Layout({ chatListContent, documentContent, children }: LayoutProps) {
  const sidebarState = useSidebarState()

  return (
    <SidebarContext.Provider value={sidebarState}>
      <div
        style={{
          height: '100vh',
          width: '100vw',
          background: 'var(--color-bg-primary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Sidebar
          activeTab={sidebarState.activeTab}
          onTabChange={sidebarState.setActiveTab}
          chatListContent={chatListContent}
          documentContent={documentContent}
        />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
