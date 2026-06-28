import { useState, useEffect } from 'react'

interface Agent {
  id: string
  name: string
  role: string
  status: string
  model: string
  provider: string
  capabilities: string[]
}

interface Issue {
  severity: string
  label: string
  title: string
  desc: string
  time: string
}

interface DashboardProps {
  health: { ollama_connected: boolean; models_installed: number; agents_registered: number } | null
}

export default function Dashboard({ health }: DashboardProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [issues, setIssues] = useState<Issue[]>([])

  useEffect(() => {
    fetch('/api/v1/agents')
      .then(r => r.json())
      .then(data => setAgents(data.agents || []))
      .catch(() => {})
  }, [])

  const freeAgents = agents.filter(a => a.status === 'free' || a.status === 'idle')
  const activeProjects = ['Project Alpha', 'Project Beta']
  const pendingIssues = issues.filter(i => i.severity !== 'low').length

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      busy: 'var(--blue)', idle: 'var(--text-muted)',
      processing: 'var(--accent)', free: 'var(--green)',
      error: 'var(--red)', sleeping: 'var(--purple)',
    }
    return map[status] || 'var(--text-muted)'
  }

  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>&#129302;</div>
          </div>
          <div className="stat-num">{agents.length}</div>
          <div className="stat-label">Total Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>&#128220;</div>
          </div>
          <div className="stat-num">{activeProjects.length}</div>
          <div className="stat-label">Active Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>&#127775;</div>
          </div>
          <div className="stat-num">{freeAgents.length}</div>
          <div className="stat-label">Free Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon" style={{ background: 'var(--orange-light)', color: 'var(--orange)' }}>&#9888;</div>
          </div>
          <div className="stat-num">{pendingIssues || 0}</div>
          <div className="stat-label">Pending Issues</div>
        </div>
      </div>

      <div className="section-header">
        <h3>&#129302; Agent Mesh <span className="count">{agents.length} agents</span></h3>
      </div>
      <div className="agent-grid">
        {agents.slice(0, 10).map(a => (
          <div
            key={a.id}
            className={`agent-card border-left-${a.status}`}
          >
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
              </div>
            </div>
            <div className="ac-foot">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.role}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
