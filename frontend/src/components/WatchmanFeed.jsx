import { motion, AnimatePresence } from 'framer-motion'
import { Empty } from './ui'

export default function WatchmanFeed({ alerts, limit }) {
  const rows = limit ? alerts.slice(-limit) : alerts
  if (!rows.length) return <Empty>No alerts yet.</Empty>
  return (
    <ul className="divide-y divide-ink/5 mono text-xs">
      <AnimatePresence initial={false}>
        {[...rows].reverse().map((a) => (
          <motion.li key={a.hash + a.ts} layout
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-2 whitespace-nowrap">
            <span className="text-ink/35">{new Date(a.ts * 1000).toLocaleTimeString()}</span>
            <span className="text-ink/80">{a.edge}</span>
            <span className="ml-auto text-ink/35">{a.hash}…</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
