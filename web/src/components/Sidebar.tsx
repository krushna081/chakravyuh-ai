interface SidebarProps {
  currentTab: string
  onNavigate: (path: string) => void
  health: { ollama_connected: boolean; models_installed: number; agents_registered: number } | null
}

export default function Sidebar({ currentTab, onNavigate, health }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '\u25A0' },
    { id: 'agents', label: 'Agents', icon: '\uD83E\uDD16' },
    { id: 'tasks', label: 'Tasks', icon: '\uD83D\uDCCB' },
    { id: 'models', label: 'Models', icon: '\u2699' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">&#9670;</div>
        <span>Chakravyuh</span> AI
        <span className="logo-version">v0.2</span>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-label">Main</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={currentTab === item.id ? 'active' : ''}
            onClick={() => onNavigate(item.id === 'dashboard' ? '/' : `/${item.id}`)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="nav-label">System</div>
        <button
          className={currentTab === 'logs' ? 'active' : ''}
          onClick={() => onNavigate('/logs')}
        >
          <span className="nav-icon">&#128196;</span> Logs
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
