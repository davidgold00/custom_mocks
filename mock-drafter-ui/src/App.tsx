import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Trophy, Settings, Users, PlayCircle, BarChart3, SlidersHorizontal } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-white border-b border-slate-200 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Trophy className="w-6 h-6" />
          <h1 className="font-bold text-lg">Mock Drafter</h1>
          <nav className="ml-auto flex gap-2">
            <Tab to="/" label="Dashboard" />
            <Tab to="/draft" label="Draft" icon={<PlayCircle className="w-4 h-4" />} />
            <SettingsDropdown />
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

/** Settings dropdown that consolidates Setup + Bots */
function SettingsDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
          open ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-700'
        }`}
      >
        <Settings className="w-4 h-4" />
        Settings
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl shadow-lg border border-slate-200 bg-white p-2"
        >
          <MenuItem
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="League Settings"
            subtitle="Open all draft settings"
            onClick={() => { setOpen(false); navigate('/setup') }}
          />
          <MenuItem
            icon={<Users className="w-4 h-4" />}
            title="Bot Settings"
            subtitle="Configure drafting personalities"
            onClick={() => { setOpen(false); navigate('/bots') }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon, title, subtitle, onClick,
}:{
  icon: React.ReactNode; title: string; subtitle?: string; onClick: ()=>void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-600">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
      </div>
    </button>
  )
}
