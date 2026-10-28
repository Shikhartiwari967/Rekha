import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Hammer, RefreshCw } from 'lucide-react'
import { Page, Card, Chip, Button, Empty } from '../components/ui'
import { useRekha, can } from '../store'

export default function Ledger() {
  const { role, demo, ledger, verify, tamper, verifyState, refreshAll } = useRekha()
  const canTamper = can.admin(role) && demo   // Tamper is a stage-only demo feature
  const [loading, setLoading] = useState(false)

  useEffect(() => { refreshAll() }, [refreshAll])

  const doVerify = async () => {
    setLoading(true)
    try { await verify() } catch { /* backend offline */ } finally { setLoading(false) }
  }
  const doTamper = (i) => tamper(i).catch(() => {})

  const entries = ledger.entries || []

  return (
    <Page
      title="Ledger"
      description={`Append-only SHA-256 hash chain with an Ed25519 signature per round.${canTamper ? ' Tamper with a row, then verify.' : ' Anyone can verify it.'}`}
      actions={<>
        <AnimatePresence mode="wait" initial={false}>
          {verifyState && (
            <motion.span key={String(verifyState.intact) + verifyState.reason}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {verifyState.intact
                ? <Chip tone="good"><ShieldCheck size={13} /> Intact · {verifyState.entries} entries</Chip>
                : <Chip tone="bad"><ShieldAlert size={13} /> {verifyState.reason}</Chip>}
            </motion.span>
          )}
        </AnimatePresence>
        <Button onClick={doVerify}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Verify chain</Button>
      </>}
    >
      <Card bodyClassName="overflow-x-auto">
        {entries.length ? (
          <table className="w-full text-sm">
            <thead className="text-xs text-ink/50 border-b border-ink/10">
              <tr>
                <th className="text-left font-medium pl-4 pr-2 py-2.5 w-12">#</th>
                <th className="text-left font-medium px-2 py-2.5">Round</th>
                <th className="text-left font-medium px-2 py-2.5">Step</th>
                <th className="text-left font-medium px-2 py-2.5">Hash</th>
                {canTamper && <th className="pr-4 py-2.5" aria-label="Actions"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {entries.map((e) => {
                const broken = verifyState && !verifyState.intact && e.index === verifyState.broken_index
                return (
                  <motion.tr key={e.index}
                    animate={broken ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`transition-colors ${broken ? 'bg-red-50' : 'hover:bg-ink/[0.02]'}`}>
                    <td className="pl-4 pr-2 py-2 mono text-xs text-ink/40">{e.index}</td>
                    <td className="px-2 py-2 tabular-nums">{e.round_id}</td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">{e.step}</td>
                    <td className={`px-2 py-2 mono text-xs whitespace-nowrap ${broken ? 'text-red-600' : 'text-ink/50'}`}>{e.hash?.slice(0, 24)}…</td>
                    {canTamper && (
                      <td className="pr-4 py-2 text-right">
                        <button onClick={() => doTamper(e.index)}
                          className="inline-flex items-center gap-1 text-xs text-ink/40 hover:text-red-600 transition-colors">
                          <Hammer size={12} /> Tamper
                        </button>
                      </td>
                    )}
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        ) : <Empty>No entries yet.</Empty>}
      </Card>

      {ledger.checkpoints?.length > 0 && (
        <Card title="Signed checkpoints" className="mt-4" bodyClassName=""
          action={<span className="text-xs text-ink/40">Ed25519</span>}>
          <ul className="divide-y divide-ink/5">
            {ledger.checkpoints.map((c) => (
              <li key={c.round_id} className="px-4 py-2 mono text-xs text-ink/60 break-all">
                <span className="text-ink font-sans font-medium">Round {c.round_id}</span> · head {c.head_hash.slice(0, 16)}… · sig {c.signature.slice(0, 32)}…
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 text-xs text-ink/50 border-t border-ink/10">
            Public key <span className="mono">{ledger.public_key?.slice(0, 32)}…</span>. Anyone can verify these offline.
          </p>
        </Card>
      )}
    </Page>
  )
}
