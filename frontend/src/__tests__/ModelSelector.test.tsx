import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModelSelector from '../components/ModelSelector'
import * as api from '../services/api'

vi.mock('../services/api')
const mockedApi = vi.mocked(api)

describe('ModelSelector', () => {
  beforeEach(() => {
    mockedApi.listModels.mockResolvedValue(['llama3', 'gpt-4', 'mistral'])
    mockedApi.selectModel.mockResolvedValue()
  })

  it('renders loading state initially', () => {
    render(<ModelSelector onClose={vi.fn()} isOpen={true} />)
    expect(screen.getByText('Loading models...')).toBeInTheDocument()
  })

  it('renders model list after loading', async () => {
    render(<ModelSelector onClose={vi.fn()} isOpen={true} />)
    await waitFor(() => {
      expect(screen.getByText('llama3')).toBeInTheDocument()
    })
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('shows all available models in dropdown', async () => {
    render(<ModelSelector onClose={vi.fn()} isOpen={true} />)
    await waitFor(() => expect(screen.getByText('llama3')).toBeInTheDocument())
    expect(screen.getByText('gpt-4')).toBeVisible()
    expect(screen.getByText('mistral')).toBeVisible()
  })

  it('selects model and calls onClose', async () => {
    const onModelChange = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ModelSelector onModelChange={onModelChange} onClose={onClose} isOpen={true} />)
    await waitFor(() => expect(screen.getByText('llama3')).toBeInTheDocument())
    await user.click(screen.getByText('gpt-4'))
    await waitFor(() => {
      expect(mockedApi.selectModel).toHaveBeenCalledWith('gpt-4')
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes dropdown on outside click', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<div><ModelSelector onClose={onClose} isOpen={true} /><div data-testid="outside">outside</div></div>)
    await waitFor(() => expect(screen.getByText('llama3')).toBeInTheDocument())
    await user.click(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalled()
  })
})
