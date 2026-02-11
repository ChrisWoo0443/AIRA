import { useState, useEffect } from 'react'
import './App.css'

interface HealthResponse {
  status: string
  service: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setHealth(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [])

  return (
    <div style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1>Research Agent - Frontend</h1>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2>Backend Health Check</h2>

        {loading && <p>Loading...</p>}

        {error && (
          <div style={{ color: '#d32f2f', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {health && (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: health.status === 'ok' ? '#4caf50' : '#ff9800',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {health.status.toUpperCase()}
              </span>
            </div>
            <div style={{ marginTop: '15px' }}>
              <strong>Service:</strong> {health.service}
            </div>
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(health, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
