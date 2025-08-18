import { Card, CardBody, CardHeader, Button, Input, Select, Slider } from '@/components/Card'
import { useUI } from '@/store'
import { Badge } from '@/components/Badge'
import { useEffect, useState } from 'react'
import type { BotProfile } from '@/types'

const PRESETS = ['Balanced','EarlyQB','LateQB','RBHeavy','ZeroRB','ZeroWR','Chaotic','AutoBPA'] as const

type LocalState = {
  globalBot: BotProfile
  bots: BotProfile[]
}

export default function ConfigureBots() {
  const { bots, setBot, setHuman, applyPreset, globalBot, setGlobalBot } = useUI()

  // Stage edits locally; nothing persists until Save
  const [local, setLocal] = useState<LocalState>({ globalBot, bots })
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Keep local in sync if store changes elsewhere
  useEffect(() => {
    setLocal({ globalBot, bots })
    setDirty(false)
  }, [globalBot, bots])

  // Warn if navigating away with unsaved changes
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  // ----- local updaters -----
  const updateGlobal = (patch: Partial<BotProfile>) => {
    setLocal(s => ({ ...s, globalBot: { ...s.globalBot, ...patch } as BotProfile }))
    setDirty(true)
  }
  const updateBot = (idx: number, patch: Partial<BotProfile>) => {
    setLocal(s => {
      const next = [...s.bots]
      next[idx] = { ...next[idx], ...patch } as BotProfile
      return { ...s, bots: next }
    })
    setDirty(true)
  }

  // ----- persist -----
  const save = () => {
    // Global
    setGlobalBot(local.globalBot)
    // Each bot (respect your existing per-bot setter API)
    local.bots.forEach((b, i) => setBot(i, b))
    setDirty(false)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 800)
  }
  const discard = () => {
    if (!dirty || window.confirm('Discard unsaved changes?')) {
      setLocal({ globalBot, bots })
      setDirty(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* GLOBAL DEFAULTS */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={save}>Save</Button>
              <Button variant="outline" onClick={discard}>Discard</Button>
              {savedFlash && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  Saved
                </span>
              )}
              {dirty && <span className="text-xs text-amber-600 ml-1">Unsaved changes</span>}
            </div>
          }
        />
        <CardBody className="space-y-4">
          <PresetRow
            value={local.globalBot.preset as string}
            onChange={(v)=>updateGlobal({ preset: v as any })}
          />
          <Grid>
            <SliderRow label="QB Priority (early ⇄ late)" value={local.globalBot.qbPriority} onChange={v=>updateGlobal({ qbPriority: v })} />
            <SliderRow label="RB Emphasis" value={local.globalBot.rbEmphasis+50} onChange={v=>updateGlobal({ rbEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="WR Emphasis" value={local.globalBot.wrEmphasis+50} onChange={v=>updateGlobal({ wrEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="TE Emphasis" value={local.globalBot.teEmphasis+50} onChange={v=>updateGlobal({ teEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="Team-Needs Sensitivity" value={local.globalBot.teamNeedsSensitivity} onChange={v=>updateGlobal({ teamNeedsSensitivity: v })} />
            <SliderRow label="Risk Tolerance" value={local.globalBot.riskTolerance} onChange={v=>updateGlobal({ riskTolerance: v })} />
            <SliderRow label="Unpredictability" value={local.globalBot.randomness} onChange={v=>updateGlobal({ randomness: v })} />
            <div className="text-sm">
              <label className="block">Earliest round to draft K/DST</label>
              <Input
                type="number" min={1} max={20}
                value={local.globalBot.avoidKdUntil}
                onChange={e=>updateGlobal({ avoidKdUntil: parseInt(e.target.value || '0', 10) })}
              />
            </div>
          </Grid>
        </CardBody>
      </Card>

      {/* INDIVIDUAL BOTS */}
      <div className="grid md:grid-cols-2 gap-6">
        {local.bots.map((b, i) => (
          <Card key={i}>
            <CardHeader
              title={<div className="font-semibold">{b.name}</div>}
              action={<Badge>{b.isHuman ? 'Human' : 'Bot'}</Badge>}
            />
            <CardBody className="space-y-3">
              <div className="flex gap-3 items-center">
                <label className="text-sm">Controlled by</label>
                <Select
                  value={b.isHuman ? 'human' : 'bot'}
                  onChange={e => {
                    const isHuman = e.target.value === 'human'
                    // local update for preview; persists on Save
                    updateBot(i, { isHuman })
                    // keep your dedicated API in sync immediately (seat ownership UX)
                    setHuman(i, isHuman)
                  }}
                >
                  <option value="bot">Bot</option>
                  <option value="human">Human</option>
                </Select>

                <label className="text-sm ml-6">Inherit Global</label>
                <input
                  type="checkbox"
                  checked={b.inheritGlobal}
                  onChange={e => updateBot(i, { inheritGlobal: e.target.checked })}
                />
              </div>

              <PresetRow
                value={b.preset as string}
                onChange={(v)=>{
                  // applyPreset transforms a bot into a preset; mirror into local immediately for UI
                  const preset = v as any
                  updateBot(i, { preset })
                  applyPreset(i, preset) // keep engine-facing state aligned for previews if you simulate quickly
                }}
              />

              {!b.inheritGlobal && (
                <>
                  <Grid>
                    <SliderRow label="QB Priority (early ⇄ late)" value={b.qbPriority} onChange={v=>updateBot(i, { qbPriority: v })} />
                    <SliderRow label="RB Emphasis" value={b.rbEmphasis+50} onChange={v=>updateBot(i, { rbEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="WR Emphasis" value={b.wrEmphasis+50} onChange={v=>updateBot(i, { wrEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="TE Emphasis" value={b.teEmphasis+50} onChange={v=>updateBot(i, { teEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="Team-Needs Sensitivity" value={b.teamNeedsSensitivity} onChange={v=>updateBot(i, { teamNeedsSensitivity: v })} />
                    <SliderRow label="Risk Tolerance" value={b.riskTolerance} onChange={v=>updateBot(i, { riskTolerance: v })} />
                    <SliderRow label="Unpredictability" value={b.randomness} onChange={v=>updateBot(i, { randomness: v })} />
                    <div className="text-sm">
                      <label className="block">Earliest round to draft K/DST</label>
                      <Input
                        type="number" min={1} max={20}
                        value={b.avoidKdUntil}
                        onChange={e=>updateBot(i, { avoidKdUntil: parseInt(e.target.value || '0', 10) })}
                      />
                    </div>
                  </Grid>

                  <div>
                    <label className="text-sm block mb-1">Favorite Players (comma-separated)</label>
                    <Input
                      placeholder="e.g., Travis Kelce, Upside RB B"
                      value={b.favorites.join(', ')}
                      onChange={e => updateBot(i, {
                        favorites: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)
                      })}
                    />
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ---------- helpers (unchanged from your version) ---------- */

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

function SliderRow({ label, value, onChange, min=0, max=100 }:
  { label: string, value: number, onChange: (v:number)=>void, min?: number, max?: number }) {
  return <div>
    <div className="text-sm mb-1">{label}</div>
    <Slider value={value} onChange={onChange} min={min} max={max} />
  </div>
}

function PresetRow({ value, onChange }: { value: string, onChange: (v:string)=>void }) {
  return <div className="flex items-center gap-3 text-sm">
    <label>Preset</label>
    <Select value={value} onChange={(e)=>onChange(e.target.value)}>
      {PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
    </Select>
  </div>
}
