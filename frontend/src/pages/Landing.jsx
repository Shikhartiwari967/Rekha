import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, ArrowRight, Lock, Gavel, Cpu, Layers, FileCheck2, Download, Users,
  Timer, Eye, PenLine, Check, Terminal, Plus, Minus, Swords, Shield, Bot,
} from 'lucide-react'
import RoomsDiagram from '../components/RoomsDiagram'
import { buttonClass, AnimatedNumber, ease } from '../components/ui'
import { useRekha } from '../store'
import { api } from '../api'

const nav = [['#how', 'How it works'], ['#features', 'Product'], ['#verify', 'Verify'], ['#faq', 'FAQ']]

const steps = [
  [Swords, 'Attack in', 'Red submits a prompt. It can only reach the referee.'],
  [Gavel, 'Policy check', 'Named rules block known jailbreaks before the model sees them.'],
  [Bot, 'Model answers', 'Fresh context and a per-team salted cache, every round.'],
  [Shield, 'Blue judges, sealed', "Blue's guard scores the raw answer. Red can't see it."],
  [Timer, 'Padded reply', 'Red gets a normalised reply in a fixed time bucket.'],
]
const stepCaption = ['', ...steps.map(([, t]) => t)]

const problems = [
  [Timer, 'Shared caches leak by timing',
    'When teams share a model server, response time reveals what others asked. The Early Bird study (2024) recovered about 89% of a hidden prompt this way.'],
  [Eye, "Attackers see the defender's score",
    "If red can read blue's verdict or the model's exact answer, every probe becomes a free oracle to tune the next one."],
  [PenLine, 'Results can be quietly edited',
    'A spreadsheet of findings proves nothing. Without a tamper-evident record, nobody outside the team can trust the numbers.'],
]

const features = [
  [Lock, 'Sealed rooms, one referee', 'Red, blue and the model never talk directly. Every message passes one referee that checks, seals and logs it.'],
  [Cpu, 'Real model under test', 'Point Rekha at a local model through Ollama (default qwen2.5:0.5b). No data leaves your machine; a deterministic mock is the fallback.'],
  [Layers, 'Attack campaigns', 'Run whole packs, jailbreaks, cross-room probes, policy-evasion rephrasings, or paste your own prompts. Every attack is stored.'],
  [FileCheck2, 'Glass-box ledger', 'Each step is chained with SHA-256 and every round is signed with Ed25519. Editing one past entry breaks verification.'],
  [Download, 'Signed audit reports', 'Export any closed round as JSON and verify it offline with a short, readable script, against the key Rekha publishes.'],
  [Users, 'Roles that match the rooms', "Red attacks, blue reads its verdicts only after a round closes, admin runs the referee. Enforced by the server, not the UI."],
]

const useCases = [
  ['AI safety teams', 'Probe a model for prompt leaks and jailbreaks before release, with results the rest of the company can verify.'],
  ['Model vendors', 'Hand customers a signed report of what was tested and what got through, instead of a slide.'],
  ['Red-team competitions', 'Let many teams attack one model fairly: no peeking at each other, no timing tricks, a referee with a public record.'],
]

const faqs = [
  ['Do I need a GPU?', 'No. The default model, qwen2.5:0.5b, runs on a laptop CPU through Ollama. Without Ollama, Rekha uses a deterministic mock model.'],
  ['Where does my data go?', 'Nowhere. Rekha, the model and the database (SQLite) all run on your machine. The landing page only shows aggregate counts.'],
  ['What exactly is real today?', 'The referee, policy checks, salted caches, fresh context, reply padding, role-based access, the SHA-256 ledger and Ed25519 signatures. OS-level isolation (gVisor, seccomp) and the eBPF watchman are represented in code, not enforced by the kernel yet.'],
  ['How do I check a report without trusting you?', 'Download the report and verify_report.py, then run it with the public key shown on this page. It recomputes every hash and checks the signature itself.'],
  ['What counts as a "leak"?', 'Anything red learns that it should not: the raw answer, its exact timing, or blue’s verdict. With Rekha on, red only ever gets RESPONSE_PROCESSED in a fixed time bucket.'],
]

function Reveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease, delay }}>
      {children}
    </motion.div>
  )
}

function SectionHead({ eyebrow, title, children }) {
  return (
    <Reveal className="max-w-2xl">
      <div className="text-sm font-medium text-ink/45">{eyebrow}</div>
      <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{title}</h2>
      {children && <p className="mt-3 text-ink/60 leading-relaxed">{children}</p>}
    </Reveal>
  )
}

/** The real diagram, cycling through the five steps. */
function LivePreview() {
  const [step, setStep] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s % 5) + 1), 1600)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="rounded-2xl border border-ink/10 bg-white shadow-lift overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 h-10 border-b border-ink/[0.08] bg-ink/[0.02]">
        {[0, 1, 2].map((i) => <span key={i} className="w-2.5 h-2.5 rounded-full bg-ink/15" />)}
        <span className="ml-3 text-xs text-ink/40 mono">rekha / arena</span>
      </div>
      <div className="p-4"><RoomsDiagram activeStep={step} rekhaOn /></div>
      <div className="flex items-center gap-3 px-4 h-11 border-t border-ink/[0.08] text-sm">
        <span className="w-5 h-5 rounded-full bg-ink text-white grid place-items-center text-xs font-medium">{step}</span>
        <AnimatePresence mode="wait">
          <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }} className="font-medium">{stepCaption[step]}</motion.span>
        </AnimatePresence>
        <span className="ml-auto mono text-xs text-ink/40">RESPONSE_PROCESSED · 500 ms</span>
      </div>
    </div>
  )
}

function LiveStats({ stats }) {
  const items = stats ? [
    [stats.runs, 'attacks run on this instance'],
    [stats.blocked, 'blocked at the door'],
    [stats.campaigns, 'campaigns'],
  ] : []
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink/55">
      {stats ? <>
        {items.map(([n, label]) => (
          <span key={label}><b className="text-ink tabular-nums"><AnimatedNumber value={n} /></b> {label}</span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${stats.chain.intact ? 'bg-green-500' : 'bg-red-500'}`} />
          ledger {stats.chain.intact ? 'intact' : 'tampered'}
        </span>
      </> : <span>Live numbers appear when the backend is running.</span>}
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {faqs.map(([q, a], i) => (
        <div key={q}>
          <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
            className="w-full flex items-center justify-between gap-4 py-4 text-left font-medium">
            {q}
            {open === i ? <Minus size={16} className="shrink-0" /> : <Plus size={16} className="shrink-0" />}
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease }} className="overflow-hidden text-ink/60 leading-relaxed">
                <span className="block pb-4 pr-8">{a}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

export default function Landing() {
  const { role } = useRekha()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = () => api.publicStats().then(setStats).catch(() => setStats(null))
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const cta = role
    ? <Link to="/app" className={`${buttonClass('primary')} h-10 px-4`}>Open console <ArrowRight size={15} /></Link>
    : <Link to="/login" className={`${buttonClass('primary')} h-10 px-4`}>Get started <ArrowRight size={15} /></Link>
  const cp = stats?.last_checkpoint

  return (
    <div className="bg-white text-ink">
      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-ink/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight"><ShieldCheck size={20} /> Rekha</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-ink/60">
            {nav.map(([href, label]) => <a key={href} href={href} className="hover:text-ink transition-colors">{label}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!role && <Link to="/login" className={buttonClass('ghost')}>Sign in</Link>}
            {role
              ? <Link to="/app" className={buttonClass('primary')}>Open console</Link>
              : <Link to="/login" className={buttonClass('primary')}>Get started</Link>}
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(10,10,10,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(10,10,10,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-3 py-1 text-xs text-ink/60">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Adversarial AI testing, self-hosted
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.05 }}
              className="mt-5 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
              Red-team your AI.<br /><span className="text-ink/40">Leak nothing.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.15 }}
              className="mt-5 text-lg text-ink/60 leading-relaxed max-w-lg">
              Rekha runs attackers, defenders and the model under test in sealed rooms behind one referee.
              Every step is hashed into a ledger and signed, so anyone can check the results.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.25 }}
              className="mt-8 flex flex-wrap gap-3">
              {cta}
              <a href="#how" className={`${buttonClass()} h-10 px-4`}>See how it works</a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10">
              <LiveStats stats={stats} />
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}>
            <LivePreview />
          </motion.div>
        </div>
      </section>

      {/* ---------- problem ---------- */}
      <section className="border-t border-ink/[0.06] bg-bg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <SectionHead eyebrow="The problem" title="Shared test rigs leak.">
            Put several teams and one model on the same server and the test itself becomes the vulnerability.
          </SectionHead>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {problems.map(([Icon, title, body], i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div className="h-full rounded-xl border border-ink/[0.08] bg-white p-6">
                  <Icon size={20} className="text-ink/70" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-ink/60 leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <SectionHead eyebrow="How it works" title="One door. Five steps. Every one recorded.">
            Attacks never touch the model directly. The referee is the only path between rooms, and it writes every step to the ledger.
          </SectionHead>
          <ol className="mt-12 grid md:grid-cols-5 gap-6 md:gap-4 relative">
            <div aria-hidden className="hidden md:block absolute top-5 left-[10%] right-[10%] h-px bg-ink/10" />
            {steps.map(([Icon, title, body], i) => (
              <Reveal key={title} delay={i * 0.08} className="relative">
                <li className="list-none">
                  <span className="relative z-10 w-10 h-10 rounded-full bg-ink text-white grid place-items-center"><Icon size={17} /></span>
                  <div className="mt-4 text-xs text-ink/40 mono">0{i + 1}</div>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink/60 leading-relaxed">{body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section id="features" className="scroll-mt-16 border-t border-ink/[0.06] bg-bg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <SectionHead eyebrow="Product" title="Everything a red-team exercise needs, and proof it was fair." />
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl overflow-hidden border border-ink/[0.08] bg-ink/[0.08]">
            {features.map(([Icon, title, body], i) => (
              <Reveal key={title} delay={(i % 3) * 0.06} className="bg-white">
                <div className="h-full p-6 group">
                  <span className="w-9 h-9 rounded-lg border border-ink/10 grid place-items-center transition-colors group-hover:bg-ink group-hover:text-white">
                    <Icon size={17} />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-ink/60 leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- verify ---------- */}
      <section id="verify" className="scroll-mt-16 bg-ink text-white">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div className="text-sm font-medium text-white/45">Verify, don't trust</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Check our results without asking us.</h2>
            <p className="mt-4 text-white/60 leading-relaxed">
              Every closed round can be exported as a signed report. The verifier is a small script you can read in five
              minutes. It recomputes every SHA-256 hash and checks the Ed25519 signature against this instance's public key.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/75">
              {['Detects any edited, removed or reordered entry', 'Checks who signed it, not just that it is signed', 'Runs offline with one dependency (PyNaCl)'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={15} className="text-green-400" /> {t}</li>
              ))}
            </ul>
            <a href={api.verifyScriptUrl} download className="mt-8 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white text-ink text-sm font-medium hover:bg-white/90 transition-colors">
              <Download size={15} /> Download verify_report.py
            </a>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="flex items-center justify-between px-4 h-10 border-b border-white/10 text-xs text-white/45">
                <span className="flex items-center gap-2"><Terminal size={13} /> Live ledger on this instance</span>
                {stats && (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${stats.chain.intact ? 'bg-green-400' : 'bg-red-400'}`} />
                    {stats.chain.intact ? 'intact' : 'tampered'}
                  </span>
                )}
              </div>
              <div className="p-4 mono text-xs leading-relaxed text-white/80 space-y-3 overflow-x-auto">
                <div>
                  <div className="text-white/40"># public key (Ed25519)</div>
                  <div className="break-all">{stats?.public_key ?? '—'}</div>
                </div>
                <div>
                  <div className="text-white/40"># latest signed checkpoint</div>
                  {cp ? <>
                    <div>round {cp.round_id} · head {cp.head_hash.slice(0, 24)}…</div>
                    <div className="break-all text-white/50">sig {cp.signature.slice(0, 64)}…</div>
                  </> : <div className="text-white/50">no rounds closed yet</div>}
                </div>
                <div>
                  <div className="text-white/40"># verify a downloaded report</div>
                  <div><span className="text-white/40">$</span> python verify_report.py rekha-round-{cp?.round_id ?? 'N'}-report.json \</div>
                  <div className="pl-4 break-all">--key {stats?.public_key?.slice(0, 16) ?? '<key>'}…</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- use cases ---------- */}
      <section className="border-b border-ink/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <SectionHead eyebrow="Who it's for" title="Built for people who have to prove their tests were fair." />
          <div className="mt-10 grid md:grid-cols-3 gap-8">
            {useCases.map(([title, body], i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div className="border-t border-ink pt-5">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-ink/60 leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section id="faq" className="scroll-mt-16 bg-bg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 grid lg:grid-cols-[1fr_1.4fr] gap-12">
          <SectionHead eyebrow="FAQ" title="Straight answers.">
            Including what is not built yet.
          </SectionHead>
          <Reveal><Faq /></Reveal>
        </div>
      </section>

      {/* ---------- final CTA ---------- */}
      <section>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
          <Reveal>
            <div className="rounded-2xl bg-ink text-white px-6 md:px-12 py-14 flex flex-col md:flex-row md:items-center gap-8">
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Run your first campaign.</h2>
                <p className="mt-3 text-white/60">Sign in as the red team, pick a pack, and get a signed report when it finishes.</p>
              </div>
              <Link to={role ? '/app/campaigns' : '/login'}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-white text-ink text-sm font-medium hover:bg-white/90 transition-colors">
                {role ? 'Go to campaigns' : 'Get started'} <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-ink/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink/45">
          <span className="flex items-center gap-2 text-ink font-medium"><ShieldCheck size={16} /> Rekha</span>
          <span>Team Gladiators · Abhigyan Khare & Shikhar Tiwari</span>
          <span>Hack in Hills '26 · Problem 04</span>
          <span className="md:ml-auto">Model on this instance: <span className="mono text-ink/70">{stats?.model ?? '—'}</span></span>
        </div>
      </footer>
    </div>
  )
}
