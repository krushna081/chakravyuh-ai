import { useState } from 'react'

export default function TaskPanel() {
  const [taskDesc, setTaskDesc] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const submitTask = async () => {
    if (!taskDesc.trim()) return
    try {
      const r = await fetch('/api/v1/task?description=' + encodeURIComponent(taskDesc) + '&priority=medium', {
        method: 'POST',
      })
      const data = await r.json()
      setResult(JSON.stringify(data, null, 2))
    } catch {
      setResult('Error: Could not reach API')
    }
  }

  return (
    <>
      <div className="section-header">
        <h3>&#128203; Submit Task</h3>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <textarea
          value={taskDesc}
          onChange={e => setTaskDesc(e.target.value)}
          placeholder="Describe the task for the agent mesh..."
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            fontFamily: 'var(--font)',
            fontSize: '0.9rem',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
            color: 'var(--text)',
            resize: 'vertical',
            marginBottom: 12,
          }}
        />
        <button className="btn btn-primary" onClick={submitTask}>
          &#9654; Submit to Agent Mesh
        </button>
      </div>

      {result && (
        <div className="card">
          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Result</div>
          <pre style={{
            fontFamily: 'var(--mono)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            background: 'var(--bg)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
          }}>
            {result}
          </pre>
        </div>
      )}

      <div className="section-header" style={{ marginTop: 28 }}>
        <h3>&#128220; Active Projects</h3>
      </div>
      <div className="project-card">
        <div className="pc-head">
          <span style={{ fontWeight: 700 }}>Sample Project</span>
          <span className="tab active" style={{ cursor: 'default' }}>Active</span>
        </div>
        <div className="pc-progress">
          <div className="progress-bar">
            <div className="fill" style={{ width: '65%' }}></div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>65%</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Submit a task above to see real-time results here.
        </div>
      </div>
    </>
  )
}
