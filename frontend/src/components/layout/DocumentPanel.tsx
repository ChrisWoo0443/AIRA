import { type ReactNode } from 'react'
import { useDocumentPanel } from '../../hooks/useDocumentPanel'

interface DocumentPanelProps {
  children: ReactNode
}

function DesktopPanel({ children }: DocumentPanelProps) {
  const { isOpen } = useDocumentPanel()

  return (
    <aside
      style={{
        width: isOpen ? 220 : 0,
        minWidth: isOpen ? 220 : 0,
        overflow: 'hidden',
        transition: 'width 200ms ease, min-width 200ms ease',
        background: 'var(--color-bg-secondary)',
        borderRight: isOpen ? '1px solid var(--color-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div style={{ padding: '12px 0', overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
    </aside>
  )
}

function MobilePanel({ children }: DocumentPanelProps) {
  const { isOpen, close } = useDocumentPanel()

  return (
    <>
      {isOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 50,
          }}
        />
      )}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 56,
          width: 220,
          zIndex: 60,
          background: 'var(--color-bg-secondary)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 0', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </aside>
    </>
  )
}

export function DocumentPanel({ children }: DocumentPanelProps) {
  const { isMobile } = useDocumentPanel()

  if (isMobile) {
    return <MobilePanel>{children}</MobilePanel>
  }

  return <DesktopPanel>{children}</DesktopPanel>
}
