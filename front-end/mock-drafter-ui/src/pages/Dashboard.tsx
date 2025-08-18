import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader, Button } from '@/components/Card'
import { useUI } from '@/store'
import { Users, SlidersHorizontal, Play, Settings } from 'lucide-react'

export default function Dashboard() {
  const { settings, bots } = useUI()
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader title="Quick Start" />
        <CardBody className="space-y-3">
          <p className="text-slate-600 text-sm">Front-end MVP to configure bots and simulate a mock draft locally.</p>
          <div className="flex gap-3">
            <Link to="/setup"><Button variant="primary"><Settings className="w-4 h-4 inline mr-2" /> Setup League</Button></Link>
            <Link to="/bots"><Button><SlidersHorizontal className="w-4 h-4 inline mr-2" /> Configure Bots</Button></Link>
            <Link to="/draft"><Button variant="outline"><Play className="w-4 h-4 inline mr-2" /> Go to Draft Room</Button></Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Current Setup" />
        <CardBody className="space-y-2">
          <div className="text-sm text-slate-700">Teams: <b>{settings.teams}</b> • Rounds: <b>{settings.rounds}</b></div>
          <div className="text-sm text-slate-700">Human Teams: <b>{bots.filter(b=>b.isHuman).length}</b> • Bot Teams: <b>{bots.filter(b=>!b.isHuman).length}</b></div>
          <div className="text-xs text-slate-500">Roster: QB {settings.roster.QB}, RB {settings.roster.RB}, WR {settings.roster.WR}, TE {settings.roster.TE}, FLEX {settings.roster.FLEX}, K {settings.roster.K}, DST {settings.roster.DST}, BENCH {settings.roster.BENCH}</div>
          <div className="pt-2">
            <Link to="/bots"><Button variant="ghost"><Users className="w-4 h-4 inline mr-2" /> View Bots</Button></Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
