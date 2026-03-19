import { type ReactNode, useRef } from 'react'
import { DocumentPanelContext, useDocumentPanelState } from '../../hooks/useDocumentPanel'
import { IconRail } from './IconRail'
import { DocumentPanel } from './DocumentPanel'

interface LayoutProps {
  panelContent: ReactNode
  children: ReactNode
}

export function Layout({ panelContent, children }: LayoutProps) {
  const documentPanelState = useDocumentPanelState()
  const mainRef = useRef<HTMLElement>(null)

  const handleScrollToBottom = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' })
    }
  }

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
        <IconRail onScrollToBottom={handleScrollToBottom} />
        <DocumentPanel>{panelContent}</DocumentPanel>
        <main
          ref={mainRef}
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
