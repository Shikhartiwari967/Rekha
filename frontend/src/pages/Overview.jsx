import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, RefreshCw, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { Page, Card, Chip, Stat, Button, Empty, buttonClass, plural } from '../components/ui'
import WatchmanFeed from '../components/WatchmanFeed'
import { StatusChip, Progress } from './Campaigns'
import { useRekha, can } from '../store'
import { api } from '../api'

function Verdicts({ rounds }) {
  if (!rounds.length) {
    return <Empty><Lock size={14} className="inline -mt-0.5 mr-1" />Sealed until the admin closes a round.</Empty>
  }
  return (
    <ul className="divide-y divide-ink/5">
      {[...rounds].reverse().flatMap(({ round, verdicts }) => verdicts.map((v, i) => (
        <li key={`${round}-${i}`} className="flex items-center gap-2 px-4 py-2 text-sm">
          {v.safe ? <CheckCircle2 size={15} className="text-green-600 shrink-0" />
            : <XCircle size={15} className="text-red-500 shrink-0" />}
          <span className="flex-1 truncate">{v.attack}</span>
          <span className="text-xs text-ink/40 whitespace-nowrap">round {round}</span>
          <Chip tone={v.safe ? 'good' : 'bad'}>{v.score}</Chip>
        </li>
      )))}
    </ul>
  )
}

export default function Overview() {
  const { role, ledger, metrics, watchman, verdicts, verifyState, verify, refreshAll } = useRekha()
  const [campaigns, setCampaigns] = useState([])

  useEffect(() => {
    verify().catch(() => {})
    const load = () => { refreshAll(); api.campaigns().then((d) => setCampaigns(d.campaigns.slice(0, 4))).catch(() => {}) }
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [verify, refreshAll])

  const m = metrics || {}
  const entries = ledger.entries || []
  const recent = entries.slice(-8).reverse()
  const chain = verifyState == null ? '—' : verifyState.intact ? 'Intact' : 'Tampered'

  return (
    <Page
      title="Overview"
      description="Red team, blue team and the model stay sealed apart. Every step is hashed and signed."
      actions={<>
        <Button onClick={() => verify().catch(() => {})}><RefreshCw size={14} /> Verify chain</Button>
        {can.attack(role) && <Link to="/app/arena" className={buttonClass('primary')}><Swords size={14} /> Open Arena</Link>}
      </>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Ledger chain" value={chain}
          tone={verifyState == null ? 'ink' : verifyState.intact ? 'good' : 'bad'}
          hint={`${plural(entries.length, 'entry', 'entries')} · ${plural(ledger.checkpoints?.length ?? 0, 'checkpoint')}`} />
        <Stat label="Attack success · Rekha on" value={m.attack_success_rate_on ?? 0} suffix="%" tone="good"
          hint={plural(m.runs_on ?? 0, 'run')} />
        <Stat label="Attack success · Rekha off" value={m.attack_success_rate_off ?? 0} suffix="%" tone="bad"
          hint={plural(m.runs_off ?? 0, 'run')} />
        <Stat label="Crossings blocked" value={m.crossings_blocked ?? 0}
          hint="Stopped by the referee's policy" />
      </div>

      <Card title="Recent campaigns" className="mb-4" bodyClassName=""
        action={<Link to="/app/campaigns" className="text-xs font-medium text-ink/60 hover:text-ink">All campaigns →</Link>}>
        {campaigns.length ? (
          <ul className="divide-y divide-ink/5">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link to={`/app/campaigns/${c.id}`} className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-ink/[0.02] transition-colors">
                  <span className="flex-1 min-w-0 truncate font-medium">{c.name}</span>
                  <span className="w-28 hidden sm:block"><Progress value={c.completed} total={c.total} /></span>
                  <span className="text-xs text-ink/45 tabular-nums whitespace-nowrap">{c.blocked} blocked · {c.completed}/{c.total}</span>
                  <StatusChip status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty>No campaigns yet. {can.attack(role) ? 'Run a full attack pack from Campaigns.' : ''}</Empty>}
      </Card>

      {can.readVerdicts(role) && (
        <Card title="Blue verdicts" className="mb-4" bodyClassName="max-h-72 overflow-auto"
          action={<span className="text-xs text-ink/40">Revealed only for closed rounds</span>}>
          <Verdicts rounds={verdicts} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card title="Recent ledger entries" bodyClassName="overflow-x-auto"
          action={<Link to="/app/ledger" className="text-xs font-medium text-ink/60 hover:text-ink">View all →</Link>}>
          {recent.length ? (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink/5">
                <AnimatePresence initial={false}>
                  {recent.map((e) => (
                    <motion.tr key={e.index} layout
                      initial={{ opacity: 0, backgroundColor: 'rgba(10,10,10,0.06)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(10,10,10,0)' }}
                      transition={{ duration: 0.6 }}>
                      <td className="pl-4 py-2 w-10 mono text-xs text-ink/35">{e.index}</td>
                      <td className="py-2 font-medium whitespace-nowrap">{e.step}</td>
                      <td className="py-2 text-ink/45 whitespace-nowrap">round {e.round_id}</td>
                      <td className="pr-4 py-2 mono text-xs text-ink/35 text-right">{e.hash.slice(0, 12)}…</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          ) : <Empty>The ledger is empty. {can.attack(role) ? 'Run an attack in the Arena.' : 'Waiting for the red team.'}</Empty>}
        </Card>

        <Card title="Watchman" bodyClassName="max-h-80 overflow-auto"
          action={<span className="text-xs text-ink/40">Hashes only</span>}>
          <WatchmanFeed alerts={watchman} limit={10} />
        </Card>
      </div>
    </Page>
  )
}
