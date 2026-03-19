import { MessageSquare, FileText, Settings } from 'lucide-react'
import { useDocumentPanel } from '../../hooks/useDocumentPanel'

interface IconRailProps {
  onScrollToBottom: () => void
}

export function IconRail({ onScrollToBottom }: IconRailProps) {
  const { isOpen, toggle } = useDocumentPanel()

  return (
    <nav
      style={{
        width: 56,
        minWidth: 56,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        background: 'var(--color-bg-rail)',
        borderRight: '1px solid var(--color-border-rail)',
        zIndex: 'var(--z-rail)',
      }}
    >
      {/* Logo badge */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #5b8af5, #a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          flexShrink: 0,
          marginBottom: 12,
        }}
      >
        A
      </div>

      {/* Nav icons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        {/* Chat button */}
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label="Scroll to latest message"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid transparent',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: 0,
          }}
          className="icon-rail-button"
        >
          <MessageSquare size={18} />
        </button>

        {/* Documents button */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle document panel"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: isOpen
              ? '1px solid rgba(91,138,245,0.3)'
              : '1px solid transparent',
            background: isOpen
              ? 'rgba(91,138,245,0.15)'
              : 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            color: isOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            padding: 0,
          }}
          className="icon-rail-button"
        >
          <FileText size={18} />
        </button>

        {/* Settings button (disabled) */}
        <button
          type="button"
          disabled
          aria-label="Settings"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'not-allowed',
            opacity: 0.5,
            color: 'var(--color-text-tertiary)',
            padding: 0,
          }}
          className="icon-rail-button"
        >
          <Settings size={18} />
        </button>
      </div>

      <style>{`
        .icon-rail-button:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .icon-rail-button:focus:not(:focus-visible) {
          outline: none;
        }
      `}</style>
    </nav>
  )
}
