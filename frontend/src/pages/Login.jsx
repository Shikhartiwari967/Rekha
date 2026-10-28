import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ShieldCheck, Swords, Shield, Gavel, ArrowRight, ArrowLeft } from 'lucide-react'
import { useRekha } from '../store'
import { Button, ease } from '../components/ui'

const roles = [
  ['Red team', 'Runs attacks through the referee', Swords],
  ['Blue team', 'Reads its sealed verdicts after a round closes', Shield],
  ['Admin', 'Runs the referee and manages accounts', Gavel],
]

const inputClass = 'w-full h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/25 focus:border-ink/40'

export default function Login() {
  const { login, online } = useRekha()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err.status === 401 ? 'Wrong username or password.'
        : err.status === 429 ? `${err.detail}.`
          : 'Cannot reach the backend. Is it running?')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-10">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={20} /> Rekha</div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">A line no tenant<br />can cross.</h1>
          {/* the "rekha" (line) draws itself */}
          <motion.div aria-hidden className="h-px w-40 bg-white/50 mt-6 origin-left"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.9, ease }} />
          <ul className="mt-8 space-y-4 max-w-sm">
            {roles.map(([label, desc, Icon]) => (
              <li key={label} className="flex gap-3">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-white/10 grid place-items-center"><Icon size={15} /></span>
                <span><span className="block text-sm font-medium">{label}</span>
                  <span className="block text-sm text-white/50">{desc}</span></span>
              </li>
            ))}
          </ul>
        </motion.div>
        <div className="text-xs text-white/30">Team Gladiators · Hack in Hills '26</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}
          className="w-full max-w-sm"
        >
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink/50 hover:text-ink mb-8">
            <ArrowLeft size={14} /> Back to home
          </Link>
          <div className="lg:hidden flex items-center gap-2 font-semibold mb-6"><ShieldCheck size={20} /> Rekha</div>
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-ink/55 mt-1">Your account decides your room. Each role only sees what it is allowed to.</p>

          <label htmlFor="username" className="block text-sm font-medium mt-6 mb-1.5">Username</label>
          <input id="username" autoComplete="username" required autoCapitalize="none" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />

          <label htmlFor="password" className="block text-sm font-medium mt-4 mb-1.5">Password</label>
          <input id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />

          <AnimatePresence>
            {error && (
              <motion.p role="alert" className="text-sm text-red-600 mt-3"
                initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" variant="primary" disabled={busy || !username || !password} className="w-full h-10 mt-5">
            {busy ? 'Signing in…' : <>Sign in <ArrowRight size={15} /></>}
          </Button>

          <p className="text-xs text-ink/45 mt-4 leading-relaxed">
            First start: sign in as <code className="mono">admin</code>, <code className="mono">red</code> or{' '}
            <code className="mono">blue</code> with the passwords from <code className="mono">backend/.env</code>, then
            add personal accounts under Users.
            {online === false && <span className="block text-red-600 mt-1">Backend offline.</span>}
          </p>
        </motion.form>
      </div>
    </div>
  )
}
