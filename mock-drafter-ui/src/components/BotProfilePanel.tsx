import { useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader, Button, Input, Select } from '@/components/Card'

/** Local model used for the editor UI.
 *  Keep this file self-contained so it doesn't depend on your app types.
 */
type QbMode = 'PRIORITY' | 'EARLIEST_ROUND'
type PresetKey = 'Balanced' | 'Hero RB' | 'Zero RB' | 'WR Heavy' | 'Chaotic'

export type BotTuning = {
  preset: PresetKey
  // QB strategy
  qbMode: QbMode
  qbPriority: number           // 0..100 (when qbMode = PRIORITY)
  qbEarliestRound: number      // 1..20 (when qbMode = EARLIEST_ROUND)
  // Position emphasis
  rbEmphasis: number           // 0..100
  wrEmphasis: number           // 0..100
  teEmphasis: number           // 0..100
  // Behavior
  teamNeedsSensitivity: number // 0..100
  riskTolerance: number        // 0..100
  unpredictability: number     // 0..100
  // Constraints
  kDstEarliestRound: number    // 1..20
}

// ---- Preset definitions (tweak to taste) ----
const PRESETS: Record<PresetKey, Partial<BotTuning>> = {
  Balanced: {
    qbMode: 'PRIORITY',
    qbPriority: 50,
    rbEmphasis: 55,
    wrEmphasis: 55,
    teEmphasis: 45,
    teamNeedsSensitivity: 60,
    riskTolerance: 45,
    unpredictability: 15,
    kDstEarliestRound: 12,
  },
  'Hero RB': {
    qbMode: 'PRIORITY',
    qbPriority: 45,
    rbEmphasis: 85,
    wrEmphasis: 60,
    teEmphasis: 40,
    teamNeedsSensitivity: 65,
    riskTolerance: 35,
    unpredictability: 10,
    kDstEarliestRound: 14,
  },
  'Zero RB': {
    qbMode: 'PRIORITY',
    qbPriority: 45,
    rbEmphasis: 20,
    wrEmphasis: 85,
    teEmphasis: 55,
    teamNeedsSensitivity: 55,
    riskTolerance: 55,
    unpredictability: 20,
    kDstEarliestRound: 13,
  },
  'WR Heavy': {
    qbMode: 'PRIORITY',
    qbPriority: 40,
    rbEmphasis: 35,
    wrEmphasis: 90,
    teEmphasis: 45,
    teamNeedsSensitivity: 55,
    riskTolerance: 45,
    unpredictability: 12,
    kDstEarliestRound: 13,
  },
  Chaotic: {
    qbMode: 'EARLIEST_ROUND',
    qbEarliestRound: 3,
    rbEmphasis: 90,
    wrEmphasis: 80,
    teEmphasis: 80,
    teamNeedsSensitivity: 30,
    riskTolerance: 80,
    unpredictability: 70,
    kDstEarliestRound: 10,
  },
}

const clamp = (v:number, lo:number, hi:number)=>Math.max(lo, Math.min(hi, v))
const asNum = (v:any)=>Number.isFinite(+v) ? +v : 0

type Props = {
  /** Whatever your store has for this bot — can be partial. */
  initial: any
  onSave: (next: any) => void
  onDiscard: () => void
}

export default function BotProfilePanel({ initial, onSave, onDiscard }: Props) {
  // Defaults merged with whatever you pass in
  const defaults: BotTuning = useMemo(() => ({
    preset: 'Balanced',
    qbMode: 'PRIORITY',
    qbPriority: 50,
    qbEarliestRound: 6,
    rbEmphasis: 55,
    wrEmphasis: 55,
    teEmphasis: 45,
    teamNeedsSensitivity: 60,
    riskTolerance: 45,
    unpredictability: 15,
    kDstEarliestRound: 12,
    ...(initial || {}),
  }), [initial])

  const [form, setForm] = useState<BotTuning>(defaults)

  // When initial changes (switching bots), reset the editor
  useEffect(() => setForm(defaults), [defaults])

  // Normalise numbers once on mount
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      qbPriority: clamp(prev.qbPriority ?? 50, 0, 100),
      qbEarliestRound: clamp(prev.qbEarliestRound ?? 6, 1, 20),
      kDstEarliestRound: clamp(prev.kDstEarliestRound ?? 12, 1, 20),
    }))
  }, [])

  // Apply a preset (only overwrite keys defined in the preset)
  function applyPreset(nextPreset: PresetKey) {
    const patch = PRESETS[nextPreset] || {}
    setForm(prev => ({ ...prev, preset: nextPreset, ...patch }))
  }

  const handleSave = () => onSave(form)

  return (
    <Card>
      <CardHeader
        title="Bot Personality"
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave}>Save</Button>
            <Button variant="outline" onClick={onDiscard}>Discard</Button>
          </div>
        }
      />
      <CardBody>
        {/* Preset */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Preset</label>
          <div className="max-w-xs">
            <Select
              value={form.preset}
              onChange={(e:any) => applyPreset(e.target.value as PresetKey)}
            >
              {Object.keys(PRESETS).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ===== QB Strategy ===== */}
          <div>
            <div className="mb-2 font-medium">QB Strategy</div>
            <div className="flex items-center gap-4 mb-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="qbmode"
                  checked={form.qbMode === 'PRIORITY'}
                  onChange={() => setForm(f => ({ ...f, qbMode: 'PRIORITY' }))}
                />
                <span className="text-sm">Priority (early ⇄ late)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="qbmode"
                  checked={form.qbMode === 'EARLIEST_ROUND'}
                  onChange={() => setForm(f => ({ ...f, qbMode: 'EARLIEST_ROUND' }))}
                />
                <span className="text-sm">Earliest round</span>
              </label>
            </div>

            {form.qbMode === 'PRIORITY' ? (
              <>
                <label className="block text-sm mb-1">QB Priority (early ⇄ late)</label>
                <Range
                  value={form.qbPriority}
                  onChange={v => setForm(f => ({ ...f, qbPriority: v }))}
                />
              </>
            ) : (
              <>
                <label className="block text-sm mb-1">Earliest round to draft QB</label>
                <div className="max-w-[140px]">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.qbEarliestRound}
                    onChange={(e:any) =>
                      setForm(f => ({ ...f, qbEarliestRound: clamp(asNum(e.target.value), 1, 20) }))
                    }
                  />
                </div>
              </>
            )}
          </div>

          <Field
            label="RB Emphasis"
            value={form.rbEmphasis}
            onChange={v => setForm(f => ({ ...f, rbEmphasis: v }))}
          />

          <Field
            label="WR Emphasis"
            value={form.wrEmphasis}
            onChange={v => setForm(f => ({ ...f, wrEmphasis: v }))}
          />

          <Field
            label="TE Emphasis"
            value={form.teEmphasis}
            onChange={v => setForm(f => ({ ...f, teEmphasis: v }))}
          />

          <Field
            label="Team‑Needs Sensitivity"
            value={form.teamNeedsSensitivity}
            onChange={v => setForm(f => ({ ...f, teamNeedsSensitivity: v }))}
          />

          <Field
            label="Risk Tolerance"
            value={form.riskTolerance}
            onChange={v => setForm(f => ({ ...f, riskTolerance: v }))}
          />

          <Field
            label="Unpredictability"
            value={form.unpredictability}
            onChange={v => setForm(f => ({ ...f, unpredictability: v }))}
          />

          <div>
            <label className="block text-sm mb-1">Earliest round to draft K/DST</label>
            <div className="max-w-[140px]">
              <Input
                type="number"
                min={1}
                max={20}
                value={form.kDstEarliestRound}
                onChange={(e:any) =>
                  setForm(f => ({ ...f, kDstEarliestRound: clamp(asNum(e.target.value), 1, 20) }))
                }
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

/* ---------- Small helper components ---------- */

function Field({ label, value, onChange }: { label: string, value: number, onChange: (v:number)=>void }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <Range value={value} onChange={onChange} />
    </div>
  )
}

function Range({ value, onChange }: { value:number, onChange:(v:number)=>void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e)=>onChange(clamp(asNum(e.target.value), 0, 100))}
        className="w-full"
      />
      <span className="w-10 text-right text-sm text-slate-600">{value}</span>
    </div>
  )
}
