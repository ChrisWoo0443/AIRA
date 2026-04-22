import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MessageList from '../components/MessageList'
import { ChatMessage } from '../types/chat'

let writeTextMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeTextMock = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(global.navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  })
})

const messages: ChatMessage[] = [
  { role: 'user', content: 'Hello', timestamp: '2026-03-18T14:00:00Z' },
  { role: 'assistant', content: 'Hi there!', timestamp: '2026-03-18T14:00:01Z' },
]

describe('MessageList', () => {
  it('renders user and assistant messages', () => {
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('right-aligns user messages', () => {
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />)
    const userMsg = screen.getByText('Hello')
    const wrapper = userMsg.parentElement!
    expect(wrapper.style.justifyContent).toBe('flex-end')
  })

  it('left-aligns assistant messages', () => {
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />)
    const assistantMsg = screen.getByText('Hi there!')
    const bubble = assistantMsg.closest('p')!.parentElement!.parentElement!
    const wrapper = bubble.parentElement!
    expect(wrapper.style.justifyContent).toBe('flex-start')
  })

  it('shows streaming content with Thinking fallback', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={true} />)
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('copies assistant message content to clipboard', async () => {
    render(<MessageList messages={messages} streamingContent="" isLoading={false} />)
    const copyButton = screen.getByTitle('Copy')
    fireEvent.click(copyButton)
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('Hi there!')
    })
  })

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<MessageList messages={messages} streamingContent="" isLoading={false} onRetry={onRetry} />)
    const retryButton = screen.getByTitle('Retry')
    await user.click(retryButton)
    expect(onRetry).toHaveBeenCalledWith(1)
  })

  it('shows empty state when no messages', () => {
    render(<MessageList messages={[]} streamingContent="" isLoading={false} />)
    expect(screen.getByText('Start a conversation')).toBeInTheDocument()
  })
})
