import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Search, Sun, Moon } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import AgentGrid from './components/AgentGrid'
import TaskPanel from './components/TaskPanel'
import ModelManager from './components/ModelManager'

interface HealthData {
  status: string
  ollama_connected: boolean
  models_installed: number
  agents_registered: number
  router_mode: string
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const currentTab = location.pathname.slice(1) || 'dashboard'

  return (
    <div className="app-layout">
      <Sidebar currentTab={currentTab} onNavigate={navigate} health={health} />
      <div className="main">
        <header className="topbar">
          <div className="page-title">
            {currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}
            <span> / Agent Control Center</span>
          </div>
          <div className="topbar-actions">
            <div className="topbar-search">
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search agents, tasks..." />
            </div>
            <button
              className="btn btn-sm"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>
        <div className="content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard health={health} />} />
            <Route path="/agents" element={<AgentGrid />} />
            <Route path="/tasks" element={<TaskPanel />} />
            <Route path="/models" element={<ModelManager />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
