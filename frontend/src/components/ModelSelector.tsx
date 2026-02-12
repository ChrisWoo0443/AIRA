import { useState, useEffect } from 'react';
import * as api from '../services/api';

interface ModelSelectorProps {
  onModelChange?: (model: string) => void;
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const availableModels = await api.listModels();
        setModels(availableModels);
        
        // Set initial selection (prefer llama3 if available)
        const preferredModel = availableModels.find(m => m.includes('llama3')) || 
                              availableModels.find(m => m.includes('llama')) ||
                              availableModels[0];
        if (preferredModel) {
          setSelectedModel(preferredModel);
          if (onModelChange) {
            onModelChange(preferredModel);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleSelectModel = async (modelName: string) => {
    try {
      setSelecting(true);
      setError(null);
      await api.selectModel(modelName);
      setSelectedModel(modelName);
      if (onModelChange) {
        onModelChange(modelName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select model');
    } finally {
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        Loading models...
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label htmlFor="model-select" style={{ fontWeight: 500, color: '#333' }}>
          AI Model:
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => handleSelectModel(e.target.value)}
          disabled={selecting || models.length === 0}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: selecting ? '#f5f5f5' : '#fff',
            cursor: selecting ? 'not-allowed' : 'pointer',
          }}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        {selecting && (
          <span style={{ fontSize: '14px', color: '#666' }}>Selecting...</span>
        )}
      </div>
      
      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          fontSize: '14px',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ 
        marginTop: '8px', 
        fontSize: '12px', 
        color: '#666',
        fontStyle: 'italic'
      }}>
        Current model: {selectedModel || 'None selected'}
      </div>
    </div>
  );
}