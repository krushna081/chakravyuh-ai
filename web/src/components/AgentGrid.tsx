import { useState, useEffect } from 'react'
import { Bot, Play, BarChart2 } from 'lucide-react'

interface Agent {
  id: string
  name: string
  role: string
  status: string
  model: string
  provider: string
  capabilities: string[]
  uptime: string
}

export default function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/agents')
      .then(r => r.json())
      .then(data => {
        setAgents(data.agents || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      busy: 'var(--blue)', idle: 'var(--text-muted)', processing: 'var(--accent)',
      free: 'var(--green)', error: 'var(--red)', sleeping: 'var(--purple)',
    }
    return map[status] || 'var(--text-muted)'
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading agents...</p>

  return (
    <>
      <div className="section-header">
        <h3><Bot size={18} /> All Agents — Full Control</h3>
        <span className="count">{agents.length} active</span>
      </div>
      <div className="agent-grid">
        {agents.map(a => (
          <div key={a.id} className={`agent-card border-left-${a.status}`}>
            <div className="ac-head">
              <div
                className="ac-avatar"
                style={{ background: `${getStatusColor(a.status)}22`, color: getStatusColor(a.status) }}
              >
                {a.name[0]}
              </div>
              <div className="ac-info">
                <div className="ac-name">{a.name}</div>
                <div className="ac-status">
                  <span className="dot" style={{ background: getStatusColor(a.status) }}></span>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </div>
              </div>
            </div>
            <div className="ac-body">
              <div className="ac-provider">
                {a.provider} &middot; {a.model}
                <span className="tag">{a.role}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Capabilities: {a.capabilities?.join(', ') || 'none'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Uptime: {a.uptime || 'N/A'}
              </div>
            </div>
            <div className="ac-foot">
              <button className="btn btn-sm btn-primary"><Play size={12} /> Assign Task</button>
              <button className="btn btn-sm"><BarChart2 size={12} /> Details</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
