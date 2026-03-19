import { renderHook, act } from '@testing-library/react'
import { useDocumentPanelState } from '../hooks/useDocumentPanel'

// Default matchMedia mock for jsdom (which doesn't provide it)
const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('useDocumentPanelState', () => {
  beforeEach(() => {
    localStorage.clear()
    mockMatchMedia(false)
  })

  it('defaults to open', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isOpen).toBe(true)
  })

  it('toggles open/closed', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
  })

  it('close sets isOpen to false', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('persists isOpen to localStorage', () => {
    const { result } = renderHook(() => useDocumentPanelState())
    act(() => result.current.toggle())
    expect(JSON.parse(localStorage.getItem('aira-document-panel-open') || 'true')).toBe(false)
  })

  it('reads persisted state on mount', () => {
    localStorage.setItem('aira-document-panel-open', 'false')
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isOpen).toBe(false)
  })

  it('isMobile reflects matchMedia', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useDocumentPanelState())
    expect(result.current.isMobile).toBe(true)
  })
})
