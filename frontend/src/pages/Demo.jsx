import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Lock } from 'lucide-react'
import { Page, Card, Chip, Button, Empty } from '../components/ui'
import RoomsDiagram from '../components/RoomsDiagram'
import { useRekha, can } from '../store'
import { api } from '../api'

const failMsg = (e, fallback) => e.detail && e.status !== 500 ? `${e.detail}.` : fallback

export default function Demo() {
  const { role, demo, rekhaOn, runAttack, closeRound, reset, busy, online } = useRekha()
  const isAdmin = can.admin(role)
  const [packs, setPacks] = useState([])
  const [selected, setSelected] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [run, setRun] = useState(null)
  const [closed, setClosed] = useState(null)
  const [error, setError] = useState(null)
  const [runCount, setRunCount] = useState(0)   // new key per run replays the step animation
  const [mode, setMode] = useState('pack')       // 'pack' | 'custom'
  const [custom, setCustom] = useState('')
  const attackText = (mode === 'pack' ? selected : custom).trim()

  useEffect(() => {
    api.attacks().then((d) => {
      setPacks(d.flat || [])
      if (d.flat?.length) setSelected(d.flat[0].text)
    }).catch(() => {})
    api.openRound().catch(() => {})
  }, [])

  const animateFlow = async (out) => {
    setRun(out); setClosed(null); setRunCount((c) => c + 1)
    const steps = out.steps.map((s) => s.n)
    for (const n of steps) {
      setActiveStep(n)
      await new Promise((r) => setTimeout(r, 650))
    }
    setActiveStep(0)
  }

  const onRun = async () => {
    if (!attackText || busy) return
    setError(null)
    try {
      const out = await runAttack(attackText)
      await animateFlow(out)
    } catch (e) {
      setError(failMsg(e, 'Could not run the attack. Is the backend running?'))
    }
  }

  const onClose = async () => {
    setError(null)
    try {
      setClosed(await closeRound())
    } catch (e) {
      setError(e.status === 409
        ? 'This round is already closed. Run an attack to start a new one.'
        : failMsg(e, 'Could not close the round. Is the backend running?'))
    }
  }

  const onReset = async () => {
    setError(null)
    try {
      await reset(); setRun(null); setClosed(null); setActiveStep(0)
      const d = await api.attacks(); setPacks(d.flat || [])
    } catch (e) {
      setError(failMsg(e, 'Could not reset. Is the backend running?'))
    }
  }

  return (
    <Page
      title="Arena"
      description={isAdmin
        ? 'Send an attack through the referee and watch each step. Toggle Rekha in the top bar.'
        : 'Send an attack through the referee. As the red team you only ever see the padded reply.'}
      actions={isAdmin && <>
        <Button onClick={onClose}><Lock size={14} /> Close round</Button>
        {demo && <Button variant="ghost" onClick={onReset}><RotateCcw size={14} /> Reset</Button>}
      </>}
    >
      {online === false && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Backend offline. Start it in the backend folder with <code className="mono">python -m uvicorn app:app --port 8000</code>, then reload.
        </div>
      )}

      <Card className="mb-4" bodyClassName="p-3 flex flex-col sm:flex-row gap-2">
        <div role="tablist" aria-label="Attack source" className="flex shrink-0 p-0.5 rounded-lg bg-ink/[0.05] h-9">
          {[['pack', 'From pack'], ['custom', 'Write your own']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className={`relative px-3 text-sm rounded-md transition-colors ${mode === id ? 'text-ink font-medium' : 'text-ink/55'}`}>
              {mode === id && <motion.span layoutId="attack-mode" className="absolute inset-0 rounded-md bg-white shadow-card" />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        <label htmlFor="attack" className="sr-only">Attack</label>
        {mode === 'pack' ? (
          <select
            id="attack"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-0 h-9 rounded-lg border border-ink/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/25"
          >
            {packs.map((a, i) => (
              <option key={i} value={a.text}>[{a.pack}] {a.text}</option>
            ))}
          </select>
        ) : (
          <input id="attack" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={2000}
            onKeyDown={(e) => e.key === 'Enter' && onRun()}
            placeholder="Type any prompt to send through the referee…"
            className="flex-1 min-w-0 h-9 rounded-lg border border-ink/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/25" />
        )}
        <Button variant="primary" onClick={onRun} disabled={busy || !attackText}><Play size={14} /> {busy ? 'Running…' : 'Run attack'}</Button>
      </Card>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" className="mb-4 text-sm text-red-600"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card title="Rooms" action={rekhaOn ? <Chip tone="good">Sealed</Chip> : <Chip tone="bad">Leaking</Chip>}>
          <motion.div
            animate={run && !rekhaOn ? { x: [0, -4, 4, -2, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <RoomsDiagram activeStep={activeStep} rekhaOn={rekhaOn} blocked={run?.blocked} />
          </motion.div>
          {!rekhaOn && (
            <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Rekha off: timing, length and blue's verdict all leak to red; the model remembers the last round.
            </div>
          )}
        </Card>

        <div className="space-y-4 min-w-0">
          <Card title="Steps" bodyClassName="">
            {run ? (
              <ol key={runCount} className="divide-y divide-ink/5">
                <AnimatePresence>
                  {run.steps.map((s, i) => (
                    <motion.li
                      key={s.name + s.n}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.25 }}
                      className={`relative px-4 py-2.5 text-sm transition-colors ${activeStep === s.n ? 'bg-ink/[0.04]' : ''}`}
                    >
                      {activeStep === s.n && (
                        <motion.span layoutId="step-active" className="absolute left-0 top-0 bottom-0 w-0.5 bg-ink" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 shrink-0 rounded-full grid place-items-center text-xs font-medium transition-colors ${
                          activeStep === s.n ? 'bg-ink text-white' : 'bg-ink/5 text-ink/60'
                        }`}>{s.n}</span>
                        <span className="font-medium mono text-xs">{s.name}</span>
                        {s.blocked && <Chip tone="bad">Blocked</Chip>}
                        {s.name === 'blue_verdict' && (s.sealed ? <Chip>Sealed</Chip> : <Chip tone="bad">Leaked</Chip>)}
                      </div>
                      <p className="text-ink/60 mt-1 pl-7">{s.detail}</p>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            ) : <Empty>Pick an attack and press Run.</Empty>}
          </Card>

          {run && (
            <Card title="What red sees">
              <div className={`mono text-sm px-3 py-2 rounded-lg ${rekhaOn ? 'bg-ink/5' : 'bg-red-50 text-red-700'}`}>
                {run.red_sees.reply}
              </div>
              <div className="text-xs text-ink/50 mt-2">
                Reply time <span className="font-medium text-ink tabular-nums">{run.red_sees.latency_ms} ms</span>{' '}
                {rekhaOn ? '· constant, no timing leak' : '· varies, leaks answer length'}
              </div>
              {!rekhaOn && run.red_sees.leaked_verdict && (
                <div className="mt-1 text-xs text-red-600">
                  Leaked blue verdict: {run.red_sees.leaked_verdict.safe ? 'safe' : 'unsafe'} · score {run.red_sees.leaked_verdict.score}
                </div>
              )}
            </Card>
          )}

          {closed && (
            <Card title={`Round ${closed.round} closed`} bodyClassName="">
              <ul className="divide-y divide-ink/5">
                {closed.revealed_verdicts.map((v, i) => (
                  <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                    {v.safe ? <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                      : <XCircle size={15} className="text-red-500 shrink-0" />}
                    <span className="flex-1 truncate">{v.attack}</span>
                    <Chip tone={v.safe ? 'good' : 'bad'}>{v.score}</Chip>
                  </li>
                ))}
                {!closed.revealed_verdicts.length && <li><Empty>No verdicts in this round.</Empty></li>}
              </ul>
              <p className="px-4 py-2 mono text-[11px] text-ink/40 break-all border-t border-ink/10">
                Ed25519 signature {closed.checkpoint.signature.slice(0, 48)}…
              </p>
            </Card>
          )}
        </div>
      </div>
    </Page>
  )
}
