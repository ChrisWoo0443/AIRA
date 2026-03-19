import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface DocumentPanelState {
  isOpen: boolean
  isMobile: boolean
  toggle: () => void
  close: () => void
}

const STORAGE_KEY = 'aira-document-panel-open'

export const DocumentPanelContext = createContext<DocumentPanelState | null>(null)

export function useDocumentPanelState(): DocumentPanelState {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored !== null ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    setIsMobile(mediaQuery.matches)
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen))
    } catch { /* ignore quota errors */ }
  }, [isOpen])

  const toggle = useCallback(() => setIsOpen(previousValue => !previousValue), [])
  const close = useCallback(() => setIsOpen(false), [])

  return { isOpen, isMobile, toggle, close }
}

export function useDocumentPanel(): DocumentPanelState {
  const context = useContext(DocumentPanelContext)
  if (!context) {
    throw new Error('useDocumentPanel must be used within a DocumentPanelProvider')
  }
  return context
}
