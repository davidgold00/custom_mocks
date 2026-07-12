import { Link } from 'react-router-dom'
import { Card, CardBody, Button } from '@/components/Card'
import { useDataset, useSources } from '@/lib/rankings'
import {
  Database, ListOrdered, Users, PlayCircle, Upload, RefreshCw, ArrowRight,
} from 'lucide-react'

export default function About() {
  const dataset = useDataset()
  const sources = useSources()
  const providers = [...new Set(sources.map((s) => s.provider))]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">About BoardRoom</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          BoardRoom is draft practice that actually feels like your league. You build a board,
          shape your opponents, and run the draft as many times as it takes for nothing on
          draft night to surprise you.
        </p>
      </div>

      <Section icon={<Users className="w-5 h-5" />} title="Bots you design — the whole point">
        <p>
          Most mock draft tools give you opponents that pick straight off a list. BoardRoom's
          bots are configurable people. Every seat has its own personality:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><b>Strategy</b> — QB timing (grab one early, or refuse until round 10), and how hard they lean RB, WR, or TE. Presets like Zero-RB, RB-Heavy, and Late-QB set these in one click.</li>
          <li><b>Team needs</b> — how much they care about filling their starting lineup versus taking the best player available.</li>
          <li><b>Risk</b> — risk-tolerant bots chase players the market disagrees about; conservative ones take the safe pick.</li>
          <li><b>Unpredictability</b> — the human element. Bots reach, panic, and snipe your guy, but within realistic limits: early-round picks barely deviate from the board, and reaches grow slowly as the draft goes on. Even at maximum chaos a bot won't do anything you'd never see a real drafter do.</li>
          <li><b>Favorites</b> — name specific players a bot loves and it will take them a bit early, just like your league-mate who drafts his hometown QB every year.</li>
        </ul>
        <p className="mt-2">
          Set a seat to mimic each person in your real league, save the whole setup, and reuse
          it all summer. That's the practice loop: <i>if my rival reaches for a QB in round 2
          and the guy I wanted gets sniped, what do I do at my next pick?</i>
        </p>
      </Section>

      <Section icon={<Database className="w-5 h-5" />} title="Live data, not stale lists">
        <p>
          Rankings come from <b>{sources.length} live sources</b> across {providers.length} providers
          ({providers.join(', ')}) — real mock-draft ADP, expert ranks, projections, and trade
          values, in PPR, Half-PPR, Standard, and Superflex flavors, plus dynasty and rookie views.
          Data refreshes itself daily when you open the app, and the
          <RefreshCw className="w-3.5 h-3.5 inline mx-1 -mt-0.5" />
          button forces the latest at any moment. Every source card shows the date its data is from.
        </p>
      </Section>

      <Section icon={<ListOrdered className="w-5 h-5" />} title="Your board drives everything">
        <p>
          Pick any source as a base, then drag players (or type a rank number) until the board
          matches your own opinions. The bots draft off <b>your</b> board — so when they take
          your sleeper two rounds early, that's the worst case you came here to rehearse.
        </p>
      </Section>

      <Section icon={<Upload className="w-5 h-5" />} title="Bring your own rankings">
        <p>
          Upload an Excel or CSV file, or paste a link (including public Google Sheets). You'll
          get a match report — who matched, who didn't and why — before anything is saved.
          Purchased analyst rankings work great here: export them to a spreadsheet and import.
        </p>
      </Section>

      <Section icon={<PlayCircle className="w-5 h-5" />} title="The draft room">
        <p>
          Claim any seat, set the timer, and draft. Watch every team's starting lineup fill in
          as picks come off the board, pause or reset anytime, and export results when it's done.
          Every draft plays out differently — run it ten times and you'll see ten different boards,
          all plausible.
        </p>
      </Section>

      <div className="text-center pt-2 pb-4">
        <div className="text-xs text-slate-400 mb-3">
          {dataset.season} season · {dataset.playerCount} players · data updated{' '}
          {new Date(dataset.fetchedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        </div>
        <Link to="/rankings">
          <Button variant="primary">
            Build your board <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </CardBody>
    </Card>
  )
}
