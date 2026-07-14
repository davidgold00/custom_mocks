import { Link } from 'react-router-dom'
import { Card, CardBody, Button } from '@/components/Card'
import { useDataset, useSources } from '@/lib/rankings'
import {
  Database, ListOrdered, Users, PlayCircle, Upload, ArrowRight,
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
          Most mock draft sims are easy to beat because the computer teams all draft the
          same way: best available, straight down a list. Run three mocks and you've seen
          everything they'll ever do. BoardRoom exists because real drafts don't work like
          that, and practicing against opponents who never surprise you isn't practice.
        </p>
      </div>

      <Section icon={<Users className="w-5 h-5" />} title="The bots are the point">
        <p>
          Every seat in the draft is its own personality. You decide when each one takes a
          QB, whether they hammer running backs or fade them completely, how much they care
          about filling their roster versus grabbing whoever's best, and how much risk they
          can stomach. There's an unpredictability dial for how far off-script they'll go,
          and you can even name specific players a bot loves, and it'll grab them a round early,
          same as your buddy who takes his hometown quarterback every single year.
        </p>
        <p className="mt-2">
          The unpredictability is kept honest. Bots reach and snipe, but within limits a
          real person would recognize: nobody's taking a fringe starter first overall.
          Early picks stay close to the board and things loosen up as the draft goes on,
          which is how actual drafts behave.
        </p>
        <p className="mt-2">
          Set up a seat for each person in your league, save the whole setup, and reuse it
          all summer. When your rival takes the QB you expected to slide, you'll have
          already been there.
        </p>
      </Section>

      <Section icon={<Database className="w-5 h-5" />} title="The data stays current">
        <p>
          Rankings come from {sources.length} live sources across {providers.length} providers
          ({providers.join(', ')}): real mock-draft ADP, expert ranks, projections, and
          trade values, covering PPR, half PPR, standard, superflex, and dynasty. The app
          refreshes itself daily when opened, there's a refresh button if news just broke,
          and every source shows the date its numbers are from. Summer rankings shift every
          week, and a sim running on July data in late August would be lying to you.
        </p>
      </Section>

      <Section icon={<ListOrdered className="w-5 h-5" />} title="Your board runs the draft">
        <p>
          Pick any source as a starting point, then drag players around (or click a rank and
          type a new one) until it matches what you actually believe. The bots draft off
          your board, not some hidden internal list. So when your sleeper goes two rounds
          early, that's not a glitch. That's the scenario you're here to rehearse.
        </p>
      </Section>

      <Section icon={<Upload className="w-5 h-5" />} title="Bring rankings from anywhere">
        <p>
          If you buy rankings or keep your own spreadsheet, upload the Excel/CSV file or
          paste a public Google Sheets link. Before anything saves, you get a report of
          which players matched and which didn't (with the reason), so a typo'd name never
          just vanishes. Imports live in your account next to the built-in sources.
        </p>
      </Section>

      <Section icon={<PlayCircle className="w-5 h-5" />} title="Then draft. A lot.">
        <p>
          Claim whichever seat you draft from, set the clock, and go. You can watch any
          team's starting lineup fill in as picks come off the board, pause whenever, and
          every finished draft saves to your account so you can look back at how each plan
          held up. No two runs play out the same, but every one of them stays plausible.
          That's the whole trick.
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
