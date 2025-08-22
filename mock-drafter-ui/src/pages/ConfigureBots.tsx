import { Card, CardBody, CardHeader, Button, Input, Select, Slider } from '@/components/Card'
import { useUI } from '@/store'
import { Badge } from '@/components/Badge'
import { useEffect, useState } from 'react'
import type { BotProfile } from '@/types'

/** Preset keys shown in the dropdowns */
const PRESETS = ['Balanced','EarlyQB','LateQB','RBHeavy','ZeroRB','ZeroWR','Chaotic','AutoBPA'] as const
type PresetKey = typeof PRESETS[number]

/** Keys a preset can set */
type PresetKeys =
  | 'qbMode' | 'qbPriority' | 'qbEarliestRound'
  | 'rbEmphasis' | 'wrEmphasis' | 'teEmphasis'
  | 'teamNeedsSensitivity' | 'riskTolerance' | 'randomness'
  | 'avoidKdUntil'

/** What fields a preset will overwrite immediately when selected */
type PresetPatch = Partial<Record<PresetKeys, BotProfile[PresetKeys]>>

/** Local preset values; tweak to taste. */
const PRESET_VALUES: Record<PresetKey, PresetPatch> = {
  Balanced: {
    qbMode: 'PRIORITY',
    qbPriority: 50,
    rbEmphasis: 0,
    wrEmphasis: 0,
    teEmphasis: 0,
    teamNeedsSensitivity: 60,
    riskTolerance: 45,
    randomness: 15,
    avoidKdUntil: 12,
  },
  EarlyQB: {
    qbMode: 'PRIORITY',
    qbPriority: 80,
    rbEmphasis: 10,
    wrEmphasis: -5,
    teEmphasis: 0,
    teamNeedsSensitivity: 55,
    riskTolerance: 40,
    randomness: 10,
    avoidKdUntil: 13,
  },
  LateQB: {
    qbMode: 'PRIORITY',
    qbPriority: 20,
    rbEmphasis: 5,
    wrEmphasis: 10,
    teEmphasis: 0,
    teamNeedsSensitivity: 60,
    riskTolerance: 50,
    randomness: 15,
    avoidKdUntil: 13,
  },
  RBHeavy: {
    qbMode: 'PRIORITY',
    qbPriority: 45,
    rbEmphasis: 25,
    wrEmphasis: -10,
    teEmphasis: -5,
    teamNeedsSensitivity: 65,
    riskTolerance: 35,
    randomness: 10,
    avoidKdUntil: 14,
  },
  ZeroRB: {
    qbMode: 'PRIORITY',
    qbPriority: 45,
    rbEmphasis: -25,
    wrEmphasis: 20,
    teEmphasis: 5,
    teamNeedsSensitivity: 55,
    riskTolerance: 55,
    randomness: 20,
    avoidKdUntil: 13,
  },
  ZeroWR: {
    qbMode: 'PRIORITY',
    qbPriority: 45,
    rbEmphasis: 20,
    wrEmphasis: -20,
    teEmphasis: 5,
    teamNeedsSensitivity: 55,
    riskTolerance: 45,
    randomness: 12,
    avoidKdUntil: 13,
  },
  Chaotic: {
    qbMode: 'EARLIEST_ROUND',
    qbEarliestRound: 3,
    rbEmphasis: 20,
    wrEmphasis: 20,
    teEmphasis: 10,
    teamNeedsSensitivity: 35,
    riskTolerance: 80,
    randomness: 70,
    avoidKdUntil: 10,
  },
  AutoBPA: {
    qbMode: 'PRIORITY',
    qbPriority: 50,
    rbEmphasis: 0,
    wrEmphasis: 0,
    teEmphasis: 0,
    teamNeedsSensitivity: 50,
    riskTolerance: 50,
    randomness: 0,
    avoidKdUntil: 12,
  },
}

type LocalState = {
  globalBot: BotProfile
  bots: BotProfile[]
}

const clamp = (n:number, lo:number, hi:number)=>Math.max(lo, Math.min(hi, n))

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

  // Apply preset patch to a BotProfile-like object
  const applyPresetPatch = (prev: BotProfile, preset: PresetKey): BotProfile => {
    const patch = PRESET_VALUES[preset] || {}
    return { ...prev, preset, ...patch } as BotProfile
  }

  // ----- persist -----
  const save = () => {
    const fix = (b: BotProfile): BotProfile => ({
      ...b,
      qbPriority: clamp(b.qbPriority ?? 50, 0, 100),
      qbEarliestRound: clamp(b.qbEarliestRound ?? 6, 1, 20),
      avoidKdUntil: clamp(b.avoidKdUntil ?? 12, 1, 20),
    } as BotProfile)

    setGlobalBot(fix(local.globalBot))
    local.bots.forEach((b, i) => setBot(i, fix(b)))
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
              {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
              {savedFlash && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  Saved
                </span>
              )}
            </div>
          }
        />
        <CardBody className="space-y-4">
          <PresetRow
            value={local.globalBot.preset as PresetKey}
            onChange={(preset)=>{
              const next = applyPresetPatch(local.globalBot, preset)
              updateGlobal(next)
            }}
          />

          {/* QB strategy block (toggle + appropriate control) */}
          <QBStrategyBlock bot={local.globalBot} onChange={updateGlobal} />

          <Grid>
            <SliderRow
              label="RB Emphasis"
              value={local.globalBot.rbEmphasis + 50}
              onChange={v=>updateGlobal({ rbEmphasis: v - 50 })}
              min={0} max={100}
            />
            <SliderRow
              label="WR Emphasis"
              value={local.globalBot.wrEmphasis + 50}
              onChange={v=>updateGlobal({ wrEmphasis: v - 50 })}
              min={0} max={100}
            />
            <SliderRow
              label="TE Emphasis"
              value={local.globalBot.teEmphasis + 50}
              onChange={v=>updateGlobal({ teEmphasis: v - 50 })}
              min={0} max={100}
            />
            <SliderRow
              label="Team-Needs Sensitivity"
              value={local.globalBot.teamNeedsSensitivity}
              onChange={v=>updateGlobal({ teamNeedsSensitivity: v })}
            />
            <SliderRow
              label="Risk Tolerance"
              value={local.globalBot.riskTolerance}
              onChange={v=>updateGlobal({ riskTolerance: v })}
            />
            <SliderRow
              label="Unpredictability"
              value={local.globalBot.randomness}
              onChange={v=>updateGlobal({ randomness: v })}
            />
            <div className="text-sm">
              <label className="block">Earliest round to draft K/DST</label>
              <Input
                type="number" min={1} max={20}
                value={local.globalBot.avoidKdUntil}
                onChange={e=>updateGlobal({ avoidKdUntil: clamp(parseInt(e.target.value || '0', 10), 1, 20) })}
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
                    updateBot(i, { isHuman })
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
                value={b.preset as PresetKey}
                onChange={(preset)=>{
                  const nextLocal = applyPresetPatch(b, preset)
                  updateBot(i, nextLocal)
                  applyPreset(i, preset)
                }}
              />

              {!b.inheritGlobal && (
                <>
                  <QBStrategyBlock bot={b} onChange={(patch)=>updateBot(i, patch)} />

                  <Grid>
                    <SliderRow
                      label="RB Emphasis"
                      value={b.rbEmphasis + 50}
                      onChange={v=>updateBot(i, { rbEmphasis: v - 50 })}
                      min={0} max={100}
                    />
                    <SliderRow
                      label="WR Emphasis"
                      value={b.wrEmphasis + 50}
                      onChange={v=>updateBot(i, { wrEmphasis: v - 50 })}
                      min={0} max={100}
                    />
                    <SliderRow
                      label="TE Emphasis"
                      value={b.teEmphasis + 50}
                      onChange={v=>updateBot(i, { teEmphasis: v - 50 })}
                      min={0} max={100}
                    />
                    <SliderRow
                      label="Team-Needs Sensitivity"
                      value={b.teamNeedsSensitivity}
                      onChange={v=>updateBot(i, { teamNeedsSensitivity: v })}
                    />
                    <SliderRow
                      label="Risk Tolerance"
                      value={b.riskTolerance}
                      onChange={v=>updateBot(i, { riskTolerance: v })}
                    />
                    <SliderRow
                      label="Unpredictability"
                      value={b.randomness}
                      onChange={v=>updateBot(i, { randomness: v })}
                    />
                    <div className="text-sm">
                      <label className="block">Earliest round to draft K/DST</label>
                      <Input
                        type="number" min={1} max={20}
                        value={b.avoidKdUntil}
                        onChange={e=>updateBot(i, { avoidKdUntil: clamp(parseInt(e.target.value || '0', 10), 1, 20) })}
                      />
                    </div>
                  </Grid>

                  <div>
                    <label className="text-sm block mb-1">Favorite Players (comma-separated)</label>
                    <Input
                      placeholder="e.g., Travis Kelce, Upside RB B"
                      value={(b.favorites || []).join(', ')}
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

/* =================== QB STRATEGY BLOCK =================== */
/** Toggle + appropriate control:
 *  - PRIORITY => slider
 *  - EARLIEST_ROUND => number Input (same style as K/DST)
 */
function QBStrategyBlock({
  bot,
  onChange,
}:{
  bot: BotProfile
  onChange: (patch: Partial<BotProfile>) => void
}) {
  const qbMode = (bot.qbMode ?? 'PRIORITY') as 'PRIORITY' | 'EARLIEST_ROUND'
  const qbPriority = bot.qbPriority ?? 50
  const qbEarliestRound = bot.qbEarliestRound ?? 6

  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">QB Strategy</div>

        {/* Segmented buttons */}
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-200">
          <button
            type="button"
            className={`px-3 py-1 text-sm ${qbMode==='PRIORITY' ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-slate-50'}`}
            onClick={() => onChange({ qbMode: 'PRIORITY' })}
          >
            Priority
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-sm border-l border-slate-200 ${qbMode==='EARLIEST_ROUND' ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-slate-50'}`}
            onClick={() => onChange({ qbMode: 'EARLIEST_ROUND' })}
          >
            Earliest Round
          </button>
        </div>
      </div>

      {qbMode === 'PRIORITY' ? (
        <SliderRow
          label="QB Priority (early ⇄ late)"
          value={qbPriority}
          onChange={(v)=>onChange({ qbPriority: v })}
        />
      ) : (
        <div className="text-sm">
          <label className="block">Earliest round to draft QB</label>
          <Input
            type="number"
            min={1}
            max={20}
            value={qbEarliestRound}
            onChange={(e)=>onChange({ qbEarliestRound: clamp(parseInt(e.target.value || '0', 10), 1, 20) })}
          />
        </div>
      )}
    </div>
  )
}

/* =================== small helpers (your existing style) =================== */

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      {/* label + live value */}
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-slate-600">{Math.round(value)}</span>
      </div>

      <Slider value={value} onChange={onChange} min={min} max={max} />

      {/* min/max caps */}
      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

function PresetRow({ value, onChange }: { value: PresetKey, onChange: (v:PresetKey)=>void }) {
  return <div className="flex items-center gap-3 text-sm">
    <label>Preset</label>
    <Select value={value} onChange={(e)=>onChange(e.target.value as PresetKey)}>
      {PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
    </Select>
  </div>
}
