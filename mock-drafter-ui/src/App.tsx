import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Trophy, Settings, Users, PlayCircle, BarChart3, SlidersHorizontal, ListOrdered, Info, LogOut, UserCircle2 } from 'lucide-react'
import { useDataset } from '@/lib/rankings'
import { useData } from '@/lib/dataStore'
import { useAuth, AUTH_BYPASS } from '@/lib/authStore'
import AuthPage from '@/pages/Auth'

export default function App() {
  const dataset = useDataset()
  const autoRefresh = useData((s) => s.autoRefresh)
  const { status, init } = useAuth()

  useEffect(() => { void init() }, [init])

  // rankings move daily with news — quietly pull the latest on open if stale
  useEffect(() => { autoRefresh() }, [autoRefresh])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    )
  }
  if (status === 'anon') return <AuthPage />

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">BoardRoom</h1>
            <div className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider leading-none">
              {dataset.season} Season
            </div>
          </div>
          <nav className="ml-auto flex gap-1.5">
            <Tab to="/" label="Dashboard" />
            <Tab to="/rankings" label="Rankings" icon={<ListOrdered className="w-4 h-4" />} />
            <Tab to="/draft" label="Draft" icon={<PlayCircle className="w-4 h-4" />} />
            <Tab to="/results" label="Results" icon={<BarChart3 className="w-4 h-4" />} />
            <SettingsDropdown />
            <Tab to="/about" label="About" icon={<Info className="w-4 h-4" />} />
            <UserMenu />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        <Outlet />
      </main>

      <footer className="py-8 text-center text-xs text-slate-400">
        {dataset.sources.length} live sources: FFC, ESPN, Sleeper, FantasyCalc, DynastyProcess, MFL ·
        {' '}{dataset.season} season · updated{' '}
        {new Date(dataset.fetchedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
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

function UserMenu() {
  const { user, logout } = useAuth()
  return (
    <div className="flex items-center gap-1 pl-2 ml-1 border-l border-slate-200">
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 font-medium px-1">
        <UserCircle2 className="w-4 h-4 text-slate-400" />
        {user?.username}
        {AUTH_BYPASS && (
          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            no auth
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        title="Sign out"
        className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
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
