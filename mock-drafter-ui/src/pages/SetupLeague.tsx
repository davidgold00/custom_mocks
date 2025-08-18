import { Card, CardBody, CardHeader, Button, Input } from '@/components/Card'
import { useUI } from '@/store'

export default function SetupLeague() {
  const { settings, setSettings } = useUI()

  const setRoster = (key: keyof typeof settings.roster, value: number) => {
    setSettings({ roster: { ...settings.roster, [key]: value } as any })
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader title="League Settings" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Teams
              <Input type="number" min={2} max={16} value={settings.teams}
                onChange={e => setSettings({ teams: parseInt(e.target.value) })} />
            </label>
            <label className="text-sm">Rounds
              <Input type="number" min={8} max={20} value={settings.rounds}
                onChange={e => setSettings({ rounds: parseInt(e.target.value) })} />
            </label>
          </div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {(['QB','RB','WR','TE','FLEX','K','DST','BENCH'] as const).map(k => (
              <label key={k}>{k}
                <Input type="number" min={0} max={10} value={(settings.roster as any)[k]}
                  onChange={e => setRoster(k, parseInt(e.target.value))} />
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setSettings({ snake: !settings.snake })}>
              {settings.snake ? 'Snake Draft ✓' : 'Snake Draft ✗'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tips" />
        <CardBody className="space-y-2 text-sm text-slate-600">
          <p>Set lineup requirements and total rounds. K/DST are usually last two rounds.</p>
          <p>Adjust to mirror your league. You can keep this simple for MVP testing.</p>
        </CardBody>
      </Card>
    </div>
  )
}
