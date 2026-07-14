import { Card, CardBody, CardHeader, Button, Input } from '@/components/Card'
import { useUI } from '@/store'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus } from 'lucide-react'

const TEAM_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18, 20] as const

// display color for each roster row
const ROLE_COLORS: Record<string, string> = {
  QB: 'bg-sky-500',
  RB: 'bg-emerald-500',
  WR: 'bg-indigo-500',
  TE: 'bg-amber-500',
  FLEX: 'bg-slate-500',
  SFLEX: 'bg-cyan-600',
  K: 'bg-fuchsia-500',
  DST: 'bg-slate-700',
  BENCH: 'bg-slate-400',
}

const DISPLAY_LABEL: Record<string, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  FLEX: 'FLEX (WR/RB/TE)',
  SFLEX: 'SUPERFLEX (QB/WR/RB/TE)',
  K: 'K',
  DST: 'DST',
  BENCH: 'BENCH',
}

export default function SetupLeague() {
  const { settings: saved, setSettings } = useUI()
  // ensure SFLEX exists locally; prefer 10 as a friendly default if store is unset
  const [local, setLocal] = useState(() => ({
    ...saved,
    teams: saved?.teams ?? 10,
    roster: { SFLEX: 0, ...saved.roster } as any,
  }))
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const navigate = useNavigate()

  // total rounds = sum of roster counts (including bench)
  const totalRounds = useMemo(() => {
    const r = local.roster as Record<string, number>
    return Object.values(r).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  }, [local.roster])

  // guard hard page unload and external links if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    const clickHandler = (e: any) => {
      if (!dirty) return
      const a = e.target.closest('a')
      if (a && a.getAttribute('href') && !a.getAttribute('href')?.startsWith('#')) {
        if (!window.confirm('Leave without saving your setup? Your changes will be discarded.')) {
          e.preventDefault()
        }
      }
    }
    document.addEventListener('click', clickHandler)
    return () => { window.removeEventListener('beforeunload', handler); document.removeEventListener('click', clickHandler) }
  }, [dirty])

  const setRoster = (key: keyof typeof local.roster, value: number) => {
    const v = Math.max(0, value)
    setLocal(prev => ({ ...prev, roster: { ...(prev.roster as any), [key]: v } as any }))
    setDirty(true)
  }
  const setField = (key: keyof typeof local, value: any) => {
    setLocal(prev => ({ ...prev, [key]: value } as any))
    setDirty(true)
  }

  const save = () => {
    // persist with rounds computed from roster size
    setSettings({ ...local, rounds: totalRounds })
    setDirty(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 800)
  }

  const discard = () => {
    if (!dirty || window.confirm('Discard unsaved changes?')) {
      setLocal({ ...saved, teams: saved?.teams ?? 10, roster: { SFLEX: 0, ...saved.roster } as any })
      setDirty(false)
    }
  }

  const goDraft = () => {
    if (dirty && !window.confirm('You have unsaved changes. Continue to Draft Room without saving?')) {
      return
    }
    navigate('/draft')
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader
          title={
            <div className="flex items-center justify-between gap-2">
              {/* left controls */}
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={save}>Save Settings</Button>
                {dirty && <Button variant="outline" onClick={discard}>Discard</Button>}
                {savedFlash && <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Saved</span>}
                {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
              </div>
              {/* right: nav to draft (confirm if dirty) */}
              <div>
                <Button variant="outline" onClick={goDraft}>Go to Draft Room</Button>
              </div>
            </div>
          }
        />
        <CardBody className="space-y-6">
          {/* General settings */}
          <section className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4">
              <h3 className="font-semibold">General Draft Settings</h3>
              <p className="text-sm text-slate-300">Set number of teams; rounds are based on roster size.</p>
            </div>

            <div className="bg-slate-50 px-5 py-5 space-y-6">
              {/* Teams chips (10 emphasized among options) */}
              <div>
                <div className="text-xs font-medium text-slate-700 mb-2">TEAMS</div>
                <div className="flex flex-wrap gap-2">
                  {TEAM_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`px-4 py-2 rounded-xl border text-sm transition ${
                        local.teams === n
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                      onClick={() => setField('teams', n)}
                    >
                      {n} <span className="opacity-70 ml-1">Teams</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Read-only total rounds */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Labeled label="Total Rounds (auto)">
                  <div className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm">
                    {totalRounds}
                  </div>
                </Labeled>
                <div className="hidden sm:block" />
              </div>
            </div>
          </section>

          {/* Roster rows with +/- controls (includes Superflex) */}
          <section className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4">
              <h3 className="font-semibold">Roster Settings</h3>
              <p className="text-sm text-slate-300">
                Set roster size by position. Superflex lets teams start a QB in a FLEX slot.
              </p>
            </div>

            <div className="bg-white px-3 sm:px-5 py-4">
              <div className="divide-y">
                {(['QB','RB','WR','TE','FLEX','SFLEX','K','DST','BENCH'] as const).map(k => (
                  <RosterRow
                    key={k}
                    label={DISPLAY_LABEL[k]}
                    value={(local.roster as any)[k] ?? 0}
                    colorClass={ROLE_COLORS[k]}
                    onChange={v => setRoster(k, v)}
                  />
                ))}
              </div>
            </div>
          </section>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tips" />
        <CardBody className="space-y-2 text-sm text-slate-600">
          <p>Claim your draft spot in the Draft Room — you don’t need to set it here.</p>
          <p>Rounds are automatically calculated from roster totals (including Bench and Superflex).</p>
          <p>If you enable Superflex, adjust other positions accordingly to keep rounds reasonable.</p>
        </CardBody>
      </Card>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function RosterRow({
  label,
  value,
  colorClass,
  onChange,
}:{
  label: string
  value: number
  colorClass: string
  onChange: (v:number)=>void
}) {
  return (
    <div className="py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-6 rounded ${colorClass} inline-block`} />
        <div className="text-sm font-medium text-slate-800">{label}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-4 h-4 text-slate-600" />
        </button>
        <div className="w-10 text-center text-sm tabular-nums">{value}</div>
        <button
          type="button"
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>
  )
}
