import { Card, CardBody, CardHeader, Button, Input, Select, Slider } from '@/components/Card'
import { useUI } from '@/store'
import { Badge } from '@/components/Badge'

const PRESETS = ['Balanced','EarlyQB','LateQB','RBHeavy','ZeroRB','ZeroWR','Chaotic','AutoBPA'] as const

export default function ConfigureBots() {
  const { bots, setBot, setHuman, applyPreset, globalBot, setGlobalBot } = useUI()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Global Defaults" />
        <CardBody className="space-y-4">
          <PresetRow value={globalBot.preset} onChange={(v)=>setGlobalBot({ preset: v as any })} />
          <Grid>
            <SliderRow label="QB Priority (early ⇄ late)" value={globalBot.qbPriority} onChange={v=>setGlobalBot({ qbPriority: v })} />
            <SliderRow label="RB Emphasis" value={globalBot.rbEmphasis+50} onChange={v=>setGlobalBot({ rbEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="WR Emphasis" value={globalBot.wrEmphasis+50} onChange={v=>setGlobalBot({ wrEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="TE Emphasis" value={globalBot.teEmphasis+50} onChange={v=>setGlobalBot({ teEmphasis: v-50 })} min={0} max={100} />
            <SliderRow label="Team-Needs Sensitivity" value={globalBot.teamNeedsSensitivity} onChange={v=>setGlobalBot({ teamNeedsSensitivity: v })} />
            <SliderRow label="Risk Tolerance" value={globalBot.riskTolerance} onChange={v=>setGlobalBot({ riskTolerance: v })} />
            <SliderRow label="Unpredictability" value={globalBot.randomness} onChange={v=>setGlobalBot({ randomness: v })} />
            <div className="text-sm">
              <label className="block">Earliest round to draft K/DST</label>
              <Input type="number" min={1} max={20} value={globalBot.avoidKdUntil}
                onChange={e=>setGlobalBot({ avoidKdUntil: parseInt(e.target.value) })} />
            </div>
          </Grid>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {bots.map((b, i) => (
          <Card key={i}>
            <CardHeader title={b.name} action={<Badge>{b.isHuman ? 'Human' : 'Bot'}</Badge>} />
            <CardBody className="space-y-3">
              <div className="flex gap-3 items-center">
                <label className="text-sm">Controlled by</label>
                <Select value={b.isHuman ? 'human' : 'bot'} onChange={e => setHuman(i, e.target.value === 'human')}>
                  <option value="bot">Bot</option>
                  <option value="human">Human</option>
                </Select>
                <label className="text-sm ml-6">Inherit Global</label>
                <input type="checkbox" checked={b.inheritGlobal} onChange={e => setBot(i, { inheritGlobal: e.target.checked })} />
              </div>

              <PresetRow value={b.preset} onChange={(v)=>applyPreset(i, v as any)} />

              {!b.inheritGlobal && (
                <>
                  <Grid>
                    <SliderRow label="QB Priority (early ⇄ late)" value={b.qbPriority} onChange={v=>setBot(i, { qbPriority: v })} />
                    <SliderRow label="RB Emphasis" value={b.rbEmphasis+50} onChange={v=>setBot(i, { rbEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="WR Emphasis" value={b.wrEmphasis+50} onChange={v=>setBot(i, { wrEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="TE Emphasis" value={b.teEmphasis+50} onChange={v=>setBot(i, { teEmphasis: v-50 })} min={0} max={100} />
                    <SliderRow label="Team-Needs Sensitivity" value={b.teamNeedsSensitivity} onChange={v=>setBot(i, { teamNeedsSensitivity: v })} />
                    <SliderRow label="Risk Tolerance" value={b.riskTolerance} onChange={v=>setBot(i, { riskTolerance: v })} />
                    <SliderRow label="Unpredictability" value={b.randomness} onChange={v=>setBot(i, { randomness: v })} />
                    <div className="text-sm">
                      <label className="block">Earliest round to draft K/DST</label>
                      <Input type="number" min={1} max={20} value={b.avoidKdUntil}
                        onChange={e=>setBot(i, { avoidKdUntil: parseInt(e.target.value) })} />
                    </div>
                  </Grid>

                  <div>
                    <label className="text-sm block mb-1">Favorite Players (comma-separated)</label>
                    <Input placeholder="e.g., Travis Kelce, Upside RB B"
                      value={b.favorites.join(', ')}
                      onChange={e => setBot(i, { favorites: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
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
