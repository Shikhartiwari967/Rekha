import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, DoorOpen, FileCheck2, Boxes, Bot, Timer, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { Page, Card, Chip } from '../components/ui'
import RoomsDiagram from '../components/RoomsDiagram'

const tabs = [
  ['how', 'How it works'],
  ['guarantees', 'Guarantees'],
  ['threats', 'Threat model'],
  ['roadmap', 'Roadmap'],
]

const flow = [
  'Attack enters the referee (red → referee).',
  'Referee runs the OPA-style policy check; blocked attacks never reach the model.',
  "Referee forwards to the model with the team's salted cache key; fresh context each round.",
  "Raw answer goes to blue's sealed guard; the verdict is sealed until the round closes.",
  'Red receives only a padded, normalised reply. Every step is hashed into the ledger.',
]

const realVsSimulated = [
  ['SHA-256 hash chain, Ed25519 checkpoints', 'Real'],
  ['Policy engine (named rules)', 'Real'],
  ['Salted per-team cache keys, fresh context', 'Real'],
  ['Reply padding and normalisation, sealed verdicts', 'Real'],
  ['gVisor sandboxes, seccomp, rootless containers', 'Simulated'],
  ['Falco / eBPF watchman', 'Simulated'],
  ['vLLM + Qwen model', 'Simulated'],
]

const stack = [
  ['Isolation', 'Docker Engine + gVisor (runsc), rootless, seccomp, cgroups v2'],
  ['Referee', 'FastAPI + OPA policies + OpenBao secrets'],
  ['Model', 'vLLM + Qwen2.5-0.5B, cache_salt per team'],
  ['Watchman', 'Falco (eBPF), hash-only alerts'],
  ['Ledger', 'PostgreSQL + Ed25519 via PyNaCl'],
  ['Dashboard', 'React + Vite + Tailwind'],
]

const objectives = [
  [Lock, 'Sealed rooms', 'Red, blue and model each in a gVisor sandbox: rootless, read-only, strict seccomp.'],
  [DoorOpen, 'One referee', 'No network path between rooms. Every message passes a policy check first.'],
  [FileCheck2, 'Glass-box ledger', 'Each step hashed into an append-only chain, with a signed Ed25519 checkpoint per round.'],
  [Boxes, 'Deployable', 'Plain Docker + gVisor on any Linux cloud VM. No special hardware.'],
  [Bot, 'Clean model', 'Fresh context every round and a separate prompt cache per team (salted keys).'],
  [Timer, 'Fair clock', 'Pinned CPU cores, memory caps and padded reply times, so speed gives nothing away.'],
]

const threats = [
  [ShieldCheck, 'text-green-600', 'Protected against', [
    'Container escapes through risky syscalls',
    'Rooms sniffing or calling each other',
    "Reading another room's secrets",
    'Prompt-cache timing leaks between teams',
    'Quietly editing past results',
  ]],
  [ShieldAlert, 'text-amber-500', 'Not yet protected', [
    'Zero-day bugs in the kernel or gVisor',
    'GPU memory side channels on a shared GPU',
    'A malicious admin with root on the host',
    'Steganographic signals in model outputs (reduced, not removed)',
  ]],
  [ShieldX, 'text-red-500', 'Guarantees break if', [
    'The host machine itself is compromised',
    'Signing keys or cache salts leak',
    'Someone turns off the referee or watchman',
  ]],
]

const milestones = [
  ['Now', 'Working proof of concept', 'Live attack-then-defend demo with a real signed ledger.'],
  ['3 months', 'Stronger walls + pilot', 'MicroVM mode (Kata / Firecracker), a pilot with Bayora, a Kubernetes operator.'],
  ['6 months', 'Private GPUs', 'A separate GPU slice per room (NVIDIA MIG) to close GPU memory side channels.'],
  ['1 year', 'Outside witnesses + cloud', 'Ledger checkpoints published to a public transparency log; CI plug-ins.'],
]

function HowItWorks() {
  return (
    <div className="space-y-4">
      <Card bodyClassName="p-3"><RoomsDiagram activeStep={0} rekhaOn /></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Data flow">
          <ol className="space-y-2.5">
            {flow.map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-5 h-5 shrink-0 rounded-full bg-ink/5 text-ink/60 grid place-items-center text-xs font-medium">{i + 1}</span>
                <span className="text-ink/70">{f}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="What runs here vs. what is simulated" bodyClassName="">
          <ul className="divide-y divide-ink/5">
            {realVsSimulated.map(([what, status]) => (
              <li key={what} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-ink/70">{what}</span>
                <Chip tone={status === 'Real' ? 'good' : 'default'}>{status}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Production stack" bodyClassName="">
        <dl className="divide-y divide-ink/5">
          {stack.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3 px-4 py-2 text-sm">
              <dt className="font-medium">{k}</dt>
              <dd className="text-ink/60">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

function Guarantees() {
  return (
    <Card bodyClassName="">
      <ul className="divide-y divide-ink/5">
        {objectives.map(([Icon, title, desc], i) => (
          <li key={title} className="flex gap-4 px-4 py-3.5">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-ink/[0.05] text-ink grid place-items-center"><Icon size={16} /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="mono text-xs text-ink/40">0{i + 1}</span>{title}
              </div>
              <p className="text-sm text-ink/60 mt-0.5">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ThreatModel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {threats.map(([Icon, color, title, items]) => (
        <Card key={title} title={<span className="flex items-center gap-2"><Icon size={15} className={color} />{title}</span>}>
          <ul className="space-y-2">
            {items.map((it) => <li key={it} className="text-sm text-ink/70">{it}</li>)}
          </ul>
        </Card>
      ))}
    </div>
  )
}

function Roadmap() {
  return (
    <Card bodyClassName="p-4">
      <ol className="relative border-l border-ink/10 ml-1.5 space-y-6">
        {milestones.map(([when, title, desc], i) => (
          <li key={when} className="pl-5 relative">
            <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-ink' : 'bg-ink/20'}`} />
            <div className="text-xs font-medium text-ink/50">{when}</div>
            <div className="text-sm font-medium mt-0.5">{title}</div>
            <p className="text-sm text-ink/60 mt-0.5">{desc}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

const panels = { how: HowItWorks, guarantees: Guarantees, threats: ThreatModel, roadmap: Roadmap }

export default function About() {
  const [params, setParams] = useSearchParams()
  const tab = panels[params.get('tab')] ? params.get('tab') : 'how'
  const Panel = panels[tab]

  return (
    <Page title="About Rekha" description="How the system works, what it guarantees, and where it is going.">
      <div role="tablist" className="flex gap-1 border-b border-ink/10 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id })}
            className={`relative shrink-0 px-3 h-9 text-sm transition-colors ${
              tab === id ? 'text-ink font-medium' : 'text-ink/55 hover:text-ink'
            }`}
          >
            {label}
            {tab === id && (
              <motion.span layoutId="about-tab" className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
            )}
          </button>
        ))}
      </div>
      <motion.div key={tab} initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
        <Panel />
      </motion.div>
    </Page>
  )
}
