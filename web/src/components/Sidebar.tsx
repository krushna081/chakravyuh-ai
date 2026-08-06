import { LayoutDashboard, Bot, CheckSquare, Cpu, FileText, Hexagon } from 'lucide-react'

interface SidebarProps {
  currentTab: string
  onNavigate: (path: string) => void
  health: { ollama_connected: boolean; models_installed: number; agents_registered: number } | null
}

export default function Sidebar({ currentTab, onNavigate, health }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'agents', label: 'Agents', Icon: Bot },
    { id: 'tasks', label: 'Tasks', Icon: CheckSquare },
    { id: 'models', label: 'Models', Icon: Cpu },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Hexagon size={18} />
        </div>
        <span>Chakravyuh</span> AI
        <span className="logo-version">v0.2</span>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-label">Main</div>
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={currentTab === id ? 'active' : ''}
            onClick={() => onNavigate(id === 'dashboard' ? '/' : `/${id}`)}
          >
            <span className="nav-icon"><Icon size={16} /></span>
            {label}
          </button>
        ))}
        <div className="nav-label">System</div>
        <button
          className={currentTab === 'logs' ? 'active' : ''}
          onClick={() => onNavigate('/logs')}
        >
          <span className="nav-icon"><FileText size={16} /></span> Logs
        </button>
      </nav>
      <div className="sidebar-foot">
        <span
          className="status-dot"
          style={{ background: health?.ollama_connected ? 'var(--green)' : 'var(--red)' }}
        />
        {health ? `${health.agents_registered} agents` : 'Connecting...'}
      </div>
    </aside>
  )
}
