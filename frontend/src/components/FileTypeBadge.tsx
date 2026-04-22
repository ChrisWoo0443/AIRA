interface FileTypeBadgeProps {
  filename: string
  className?: string
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  pdf: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  md: { bg: 'rgba(163, 144, 112, 0.12)', text: '#a39070' },
  txt: { bg: 'rgba(235,235,245,0.08)', text: 'rgba(235,235,245,0.6)' },
}

const DEFAULT_COLOR = { bg: 'rgba(235,235,245,0.06)', text: 'rgba(235,235,245,0.38)' }

export default function FileTypeBadge({ filename, className }: FileTypeBadgeProps) {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  const label = extension.toUpperCase() || 'FILE'
  const colors = TYPE_COLORS[extension] || DEFAULT_COLOR

  return (
    <div
      className={className}
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        background: colors.bg,
        color: colors.text,
        fontSize: 8,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}
