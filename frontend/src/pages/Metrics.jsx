import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Page, Card, Stat, plural, ease } from '../components/ui'
import WatchmanFeed from '../components/WatchmanFeed'
import { useRekha } from '../store'

function Bar({ label, pct, tone }) {
  const color = tone === 'bad' ? 'bg-red-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-ink/70">{label}</span><span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-ink/5 overflow-hidden">
        <motion.div className={`h-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease }} />
      </div>
    </div>
  )
}

export default function Metrics() {
  const { metrics, watchman, refreshAll } = useRekha()
  useEffect(() => {
    refreshAll()
    const t = setInterval(refreshAll, 3000)
    return () => clearInterval(t)
  }, [refreshAll])

  const m = metrics || {}
  return (
    <Page title="Metrics" description="Measured live from this backend, refreshed every 3 seconds.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Attack success · Rekha off" value={m.attack_success_rate_off ?? 0} suffix="%" tone="bad" hint={plural(m.runs_off ?? 0, 'run')} />
        <Stat label="Attack success · Rekha on" value={m.attack_success_rate_on ?? 0} suffix="%" tone="good" hint={plural(m.runs_on ?? 0, 'run')} />
        <Stat label="Crossings blocked" value={m.crossings_blocked ?? 0} />
        <Stat label="Avg padding overhead" value={m.avg_latency_overhead_ms ?? 0} suffix="ms" hint="Cost of the constant 500 ms reply" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Prompt-cache timing leak" action={<span className="text-xs text-ink/40">Study figure, not measured here</span>}>
          <div className="space-y-4">
            <Bar label="Shared cache (Rekha off)" pct={m.cache_leak_shared_pct ?? 89} tone="bad" />
            <Bar label="Salted per-team cache (Rekha on)" pct={m.cache_leak_salted_pct ?? 0} tone="good" />
          </div>
          <p className="text-xs text-ink/50 mt-4">
            Early Bird (2024): about 89% of a hidden prompt's tokens recovered by timing a shared LLM cache.
            Salted per-team keys close it.
          </p>
        </Card>

        <Card title="Watchman feed" bodyClassName="max-h-80 overflow-auto"
          action={<span className="text-xs text-ink/40">Hashes only, never contents</span>}>
          <WatchmanFeed alerts={watchman} />
        </Card>
      </div>
    </Page>
  )
}
