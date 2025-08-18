import { Card, CardBody, CardHeader, Button, Input } from '@/components/Card'
import { useUI } from '@/store'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SetupLeague() {
  const { settings: saved, setSettings, humanIndex, setHumanIndex } = useUI()
  const [local, setLocal] = useState(saved)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const navigate = useNavigate()

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
    setLocal({ ...local, roster: { ...local.roster, [key]: value } as any })
    setDirty(true)
  }
  const setField = (key: keyof typeof local, value: any) => {
    setLocal({ ...local, [key]: value } as any)
    setDirty(true)
  }

  const save = () => {
    setSettings(local)
    setDirty(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 800)
  }

  const discard = () => {
    if (!dirty || window.confirm('Discard unsaved changes?')) {
      setLocal(saved)
      setDirty(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={save}>Save Settings</Button>
              <Button variant="outline" onClick={discard}>Discard</Button>
              {savedFlash && <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Saved</span>}
            </div>
          }
        />
        <CardBody className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Labeled label="Teams"><Input type="number" value={local.teams} onChange={e=>setField('teams', parseInt(e.target.value||'0'))}/></Labeled>
            <Labeled label="Rounds"><Input type="number" value={local.rounds} onChange={e=>setField('rounds', parseInt(e.target.value||'0'))}/></Labeled>
            <Labeled label="Your Draft Spot"><Input type="number" min={1} max={local.teams} value={(humanIndex ?? 0)+1} onChange={e=>setHumanIndex(Math.min(Math.max(0, parseInt(e.target.value||'1')-1), local.teams-1))}/></Labeled>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Roster Requirements</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['QB','RB','WR','TE','FLEX','K','DST','BENCH'] as const).map(k => (
                <Labeled key={k} label={k}>
                  <Input type="number" min={0} value={(local.roster as any)[k]}
                    onChange={e=>setRoster(k, parseInt(e.target.value||'0'))}/>
                </Labeled>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={save}>Save</Button>
            <Button variant="outline" onClick={()=> navigate('/draft')}>Go to Draft Room</Button>
            {dirty && <span className="text-xs text-amber-600 self-center">You have unsaved changes</span>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tips" />
        <CardBody className="space-y-2 text-sm text-slate-600">
          <p>Set lineup requirements and total rounds. K/DST are usually last two rounds.</p>
          <p>Pick your draft spot to play as a human against the bots.</p>
        </CardBody>
      </Card>
    </div>
  )
}

function Labeled({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}
