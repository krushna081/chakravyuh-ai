import { useState, useEffect } from 'react'
import { Cpu, Download, Trash2, CheckCircle2 } from 'lucide-react'

export default function ModelManager() {
  const [models, setModels] = useState<string[]>([])
  const [recommended, setRecommended] = useState<string[]>([])
  const [pullName, setPullName] = useState('')

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const r = await fetch('/api/v1/models')
      const data = await r.json()
      setModels(data.models?.map((m: { name: string }) => m.name) || [])
      setRecommended(data.recommended || [])
    } catch {}
  }

  const pullModel = async () => {
    if (!pullName.trim()) return
    try {
      await fetch('/api/v1/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullName }),
      })
      setPullName('')
      alert(`Pulling ${pullName} in background...`)
    } catch {}
  }

  const deleteModel = async (name: string) => {
    try {
      await fetch(`/api/v1/models/${name}`, { method: 'DELETE' })
      fetchModels()
    } catch {}
  }

  return (
    <>
      <div className="section-header">
        <h3><Cpu size={18} /> Model Manager</h3>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={pullName}
            onChange={e => setPullName(e.target.value)}
            placeholder="e.g., llama3.2:3b"
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
            onKeyDown={e => e.key === 'Enter' && pullModel()}
          />
          <button className="btn btn-primary" onClick={pullModel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Pull Model
          </button>
        </div>
      </div>

      <div className="section-header">
        <h3>Installed Models <span className="count">{models.length}</span></h3>
      </div>

      {models.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>No models installed. Pull one above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {models.map(name => (
            <div key={name} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--green)', background: 'var(--green-light)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> installed
                </span>
              </div>
              <button className="btn btn-sm btn-red" onClick={() => deleteModel(name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={12} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {recommended.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 28 }}>
            <h3>Recommended Models</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recommended.map(name => (
              <button
                key={name}
                className="btn btn-sm"
                onClick={() => setPullName(name)}
                style={models.includes(name) ? { opacity: 0.5, cursor: 'default' } : {}}
                disabled={models.includes(name)}
              >
                {name} {models.includes(name) ? '(installed)' : '+ Pull'}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
