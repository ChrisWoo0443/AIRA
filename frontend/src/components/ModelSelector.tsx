import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { listModels, selectModel } from '../services/api'

interface ModelSelectorProps {
  onModelChange?: (model: string) => void
}

export default function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
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
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (modelName: string) => {
    try {
      setError(null)
      await selectModel(modelName)
      setSelectedModel(modelName)
      setIsOpen(false)
      onModelChange?.(modelName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select model')
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
        }}
      >
        Loading...
      </div>
    )
  }

  if (error || models.length === 0) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          fontSize: 11,
          color: 'var(--color-status-error)',
        }}
      >
        {error || 'No models available'}
      </div>
    )
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          fontSize: 11,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)'
        }}
      >
        {selectedModel}
        <ChevronDown size={12} />
      </button>

      <div
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 40,
          minWidth: 160,
          overflow: 'hidden',
          visibility: isOpen ? 'visible' : 'hidden',
          opacity: isOpen ? 1 : 0,
        }}
      >
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
    </div>
  )
}
