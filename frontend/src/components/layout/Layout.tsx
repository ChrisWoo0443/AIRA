import { type ReactNode } from 'react'
import { DocumentPanelContext, useDocumentPanelState } from '../../hooks/useDocumentPanel'
import { IconRail } from './IconRail'
import { DocumentPanel } from './DocumentPanel'

interface LayoutProps {
  chatListContent: ReactNode
  documentContent: ReactNode
  children: ReactNode
}

export function Layout({ chatListContent, documentContent, children }: LayoutProps) {
  const documentPanelState = useDocumentPanelState()

  const panelContent = documentPanelState.activePanel === 'chats'
    ? chatListContent
    : documentContent

  return (
    <DocumentPanelContext.Provider value={documentPanelState}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          background: 'var(--color-bg-primary)',
        }}
      >
        <IconRail />
        <DocumentPanel>{panelContent}</DocumentPanel>
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
    </DocumentPanelContext.Provider>
  )
}
