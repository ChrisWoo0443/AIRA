import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { listModels, selectModel } from '../services/api'

interface ModelSelectorProps {
  onModelChange?: (model: string) => void
  onClose: () => void
  isOpen: boolean
}

export default function ModelSelector({ onModelChange, onClose, isOpen }: ModelSelectorProps) {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true)
        setError(null)
        const availableModels = await listModels()
        setModels(availableModels)

        const preferredModel =
          availableModels.find(m => m.includes('llama3')) ||
          availableModels.find(m => m.includes('llama')) ||
          availableModels[0]

        if (preferredModel) {
          setSelectedModel(preferredModel)
          onModelChange?.(preferredModel)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models')
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const handleSelect = async (modelName: string) => {
    try {
      setError(null)
      await selectModel(modelName)
      setSelectedModel(modelName)
      onModelChange?.(modelName)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select model')
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
        }}
      >
        Loading models...
      </div>
    )
  }

  if (error || models.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          fontSize: 11,
          color: 'var(--color-status-error)',
        }}
      >
        {error || 'No models available'}
      </div>
    )
  }

  return (
    <div
      ref={dropdownRef}
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        minWidth: 180,
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          padding: '10px 14px 6px',
        }}
      >
        Model
      </div>

      {models.map(model => {
        const isActive = model === selectedModel
        return (
          <div
            key={model}
            onClick={() => handleSelect(model)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              fontSize: 11,
              cursor: 'pointer',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span>{model}</span>
            {isActive && <Check size={12} />}
          </div>
        )
      })}
    </div>
  )
}
