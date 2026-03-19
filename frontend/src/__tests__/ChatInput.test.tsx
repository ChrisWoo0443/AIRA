import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '../components/ChatInput'
import type { Document } from '../types/document'

describe('ChatInput', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    disabled: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea with placeholder "Message AIRA..."', () => {
    render(<ChatInput {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('submits on Enter without Shift', async () => {
    const onSubmit = vi.fn()
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...')

    await userEvent.type(textarea, 'hello world')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSubmit).toHaveBeenCalledWith('hello world')
  })

  it('inserts newline on Shift+Enter and does not submit', async () => {
    const onSubmit = vi.fn()
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...')

    await userEvent.type(textarea, 'line one')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit when disabled', () => {
    const onSubmit = vi.fn()
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} disabled={true} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...')

    // Set value directly since typing into disabled textarea is blocked
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit empty input', () => {
    const onSubmit = vi.fn()
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...')

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears input after submit', async () => {
    const onSubmit = vi.fn()
    render(<ChatInput {...defaultProps} onSubmit={onSubmit} />)
    const textarea = screen.getByPlaceholderText('Message AIRA...') as HTMLTextAreaElement

    await userEvent.type(textarea, 'hello')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(textarea.value).toBe('')
  })

  it('Enter selects autocomplete item instead of submitting when autocomplete is open', async () => {
    const onSubmit = vi.fn()
    const onDocumentMention = vi.fn()
    const documents: Document[] = [
      { id: 'doc-1', filename: 'report.pdf', size: 1024, upload_date: '2026-03-18T00:00:00Z' },
    ]

    render(
      <ChatInput
        {...defaultProps}
        onSubmit={onSubmit}
        documents={documents}
        onDocumentMention={onDocumentMention}
      />
    )

    const textarea = screen.getByPlaceholderText('Message AIRA...')
    await userEvent.type(textarea, '@rep')

    // Autocomplete should show the matching document
    expect(screen.getByText('report.pdf')).toBeInTheDocument()

    // Press Enter to select autocomplete item
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(onDocumentMention).toHaveBeenCalledWith('doc-1')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
