import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
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

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

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
              <span>&#128269;</span>
              <input type="text" placeholder="Search agents, tasks..." />
            </div>
          </div>
        </header>
        <div className="content">
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
