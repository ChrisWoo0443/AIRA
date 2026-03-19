import { type ReactNode } from 'react'
import { useDocumentPanel } from '../../hooks/useDocumentPanel'

interface DocumentPanelProps {
  children: ReactNode
  onUploadClick?: () => void
}

function PanelHeader({ onUploadClick }: { onUploadClick?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 16px 8px',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}
      >
        DOCUMENTS
      </span>
      {onUploadClick && (
        <button
          type="button"
          onClick={onUploadClick}
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          + Upload
        </button>
      )}
    </div>
  )
}

function DesktopPanel({ children, onUploadClick }: DocumentPanelProps) {
  const { isOpen } = useDocumentPanel()

  return (
    <aside
      style={{
        width: isOpen ? 200 : 0,
        minWidth: isOpen ? 200 : 0,
        overflow: 'hidden',
        transition: 'width 200ms ease, min-width 200ms ease',
        background: 'var(--color-bg-secondary)',
        borderRight: isOpen ? '1px solid var(--color-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <PanelHeader onUploadClick={onUploadClick} />
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
    </aside>
  )
}

function MobilePanel({ children, onUploadClick }: DocumentPanelProps) {
  const { isOpen, close } = useDocumentPanel()

  return (
    <>
      {/* Backdrop overlay */}
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

      {/* Slide-out panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 56,
          width: 200,
          zIndex: 60,
          background: 'var(--color-bg-secondary)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PanelHeader onUploadClick={onUploadClick} />
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </aside>
    </>
  )
}

export function DocumentPanel({ children, onUploadClick }: DocumentPanelProps) {
  const { isMobile } = useDocumentPanel()

  if (isMobile) {
    return <MobilePanel onUploadClick={onUploadClick}>{children}</MobilePanel>
  }

  return <DesktopPanel onUploadClick={onUploadClick}>{children}</DesktopPanel>
}
