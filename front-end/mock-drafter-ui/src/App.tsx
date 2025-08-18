import { Outlet, NavLink } from 'react-router-dom'
import { Football, Settings, Users, PlayCircle, BarChart3 } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Football className="w-6 h-6" />
          <h1 className="font-bold text-lg">Mock Drafter</h1>
          <nav className="ml-auto flex gap-2">
            <Tab to="/" label="Dashboard" />
            <Tab to="/setup" label="Setup" icon={<Settings className="w-4 h-4" />} />
            <Tab to="/bots" label="Bots" icon={<Users className="w-4 h-4" />} />
            <Tab to="/draft" label="Draft" icon={<PlayCircle className="w-4 h-4" />} />
            <Tab to="/results" label="Results" icon={<BarChart3 className="w-4 h-4" />} />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="py-8 text-center text-xs text-slate-500">
        Built for MVP demo — front-end only.
      </footer>
    </div>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full text-sm font-medium transition ${
          isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-700'
        }`
      }
    >
      <span className="inline-flex items-center gap-2">{icon}{label}</span>
    </NavLink>
  )
}
