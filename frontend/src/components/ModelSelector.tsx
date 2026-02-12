import { useState, useEffect } from 'react';
import clsx from 'clsx';
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
      <div className="p-4 text-center">
        Loading models...
      </div>
    );
  }

  return (
    <div className="p-4 mb-4">
      <div className="flex items-center gap-4">
        <label htmlFor="model-select" className="font-medium text-gray-800">
          AI Model:
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => handleSelectModel(e.target.value)}
          disabled={selecting || models.length === 0}
          className={clsx(
            "px-3 py-2 text-sm font-sans border border-gray-200 rounded",
            selecting ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-pointer"
          )}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        {selecting && (
          <span className="text-sm text-gray-500">Selecting...</span>
        )}
      </div>

      {error && (
        <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500 italic">
        Current model: {selectedModel || 'None selected'}
      </div>
    </div>
  );
}