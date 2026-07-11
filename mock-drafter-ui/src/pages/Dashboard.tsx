import { Link } from 'react-router-dom'
import { Card, CardBody, Button } from '@/components/Card'
import { useUI } from '@/store'
import { useBoard, SOURCES, SEASON, DATA_UPDATED } from '@/lib/rankings'
import { ListOrdered, Settings, SlidersHorizontal, Play, Database, ArrowRight } from 'lucide-react'

export default function Dashboard() {
  const { settings, bots, rankings } = useUI()
  const board = useBoard()
  const source = SOURCES.find((s) => s.id === rankings.baseSourceId)
  const edited = rankings.customOrder !== null

  const steps = [
    {
      to: '/rankings',
      icon: <ListOrdered className="w-5 h-5" />,
      title: '1 · Set your rankings',
      desc: edited
        ? `Custom board based on ${source?.label ?? 'a public source'}`
        : `Following ${source?.label ?? 'a public source'} — customize it to match your cheat sheet`,
      cta: 'Open Rankings',
    },
    {
      to: '/setup',
      icon: <Settings className="w-5 h-5" />,
      title: '2 · Configure your league',
      desc: `${settings.teams} teams · ${settings.rounds} rounds · snake`,
      cta: 'League Settings',
    },
    {
      to: '/bots',
      icon: <SlidersHorizontal className="w-5 h-5" />,
      title: '3 · Shape your opponents',
      desc: 'Give every seat a personality — early-QB, Zero-RB, chaotic reachers',
      cta: 'Configure Bots',
    },
    {
      to: '/draft',
      icon: <Play className="w-5 h-5" />,
      title: '4 · Draft',
      desc: 'Claim a seat and practice against your league, over and over',
      cta: 'Enter Draft Room',
    },
  ]

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-8 md:p-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium mb-4">
            <Database className="w-3.5 h-3.5" />
            Live {SEASON} data · {board.length} players · updated{' '}
            {DATA_UPDATED.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Practice for your real draft.
          </h2>
          <p className="mt-3 text-indigo-100 text-sm md:text-base">
            Start from live {SEASON} ADP or expert ranks, reshape the board to match your own
            cheat sheet, and mock against opponents who reach, snipe, and panic — so draft
            night never surprises you.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/rankings">
              <Button className="!bg-white !text-indigo-700 hover:!bg-indigo-50">
                Build your board <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/draft">
              <Button className="!bg-indigo-500/40 !text-white border border-white/30 hover:!bg-indigo-500/60">
                Jump into a mock
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* steps */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <Link key={s.to + s.title} to={s.to} className="group">
            <Card className="h-full transition group-hover:border-indigo-300 group-hover:shadow-md">
              <CardBody className="flex flex-col h-full">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  {s.icon}
                </div>
                <div className="font-semibold text-sm">{s.title}</div>
                <p className="text-xs text-slate-500 mt-1 flex-1">{s.desc}</p>
                <div className="mt-3 text-xs font-semibold text-indigo-600 inline-flex items-center gap-1">
                  {s.cta} <ArrowRight className="w-3 h-3 transition group-hover:translate-x-0.5" />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* current setup summary */}
      <Card>
        <CardBody className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Stat label="Base rankings" value={source?.label ?? '—'} />
          <Stat label="Your edits" value={edited ? 'Custom board' : 'None yet'} />
          <Stat label="League" value={`${settings.teams} teams · ${settings.rounds} rounds`} />
          <Stat
            label="Roster"
            value={`${settings.roster.QB} QB · ${settings.roster.RB} RB · ${settings.roster.WR} WR · ${settings.roster.TE} TE · ${settings.roster.FLEX} FLX · ${settings.roster.K} K · ${settings.roster.DST} DST`}
          />
          <Stat label="Seats" value={`${bots.filter((b) => b.isHuman).length} human · ${bots.filter((b) => !b.isHuman).length} bots`} />
        </CardBody>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className="text-slate-700 font-medium mt-0.5">{value}</div>
    </div>
  )
}
