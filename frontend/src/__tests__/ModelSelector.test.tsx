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
    render(<ModelSelector />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders model name in pill after loading', async () => {
    render(<ModelSelector />)
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('llama3')
    })
  })

  it('opens dropdown on pill click', async () => {
    const user = userEvent.setup()
    render(<ModelSelector />)
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('llama3'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('gpt-4')).toBeVisible()
    expect(screen.getByText('mistral')).toBeVisible()
  })

  it('selects model and closes dropdown', async () => {
    const onModelChange = vi.fn()
    const user = userEvent.setup()
    render(<ModelSelector onModelChange={onModelChange} />)
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('llama3'))
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('gpt-4'))
    await waitFor(() => {
      expect(mockedApi.selectModel).toHaveBeenCalledWith('gpt-4')
    })
  })

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup()
    render(<div><ModelSelector /><div data-testid="outside">outside</div></div>)
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('llama3'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('gpt-4')).toBeVisible()
    await user.click(screen.getByTestId('outside'))
    await waitFor(() => {
      expect(screen.queryByText('gpt-4')).not.toBeVisible()
    })
  })
})
