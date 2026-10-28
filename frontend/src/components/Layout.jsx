import { NavLink, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, LayoutDashboard, Swords, FileCheck2, BarChart3, BookOpen, LogOut, Layers, Cpu, Users } from 'lucide-react'
import { useRekha, can } from '../store'

const sections = [
  ['Workspace', [
    ['/app', 'Overview', LayoutDashboard],
    ['/app/arena', 'Arena', Swords, can.attack],
    ['/app/campaigns', 'Campaigns', Layers],
    ['/app/ledger', 'Ledger', FileCheck2],
    ['/app/metrics', 'Metrics', BarChart3],
  ]],
  ['Learn', [
    ['/app/about', 'About Rekha', BookOpen],
  ]],
  ['Admin', [
    ['/app/users', 'Users', Users, can.admin],
  ]],
]

export const roleInfo = {
  red: { label: 'Red team', dot: 'bg-red-500' },
  blue: { label: 'Blue team', dot: 'bg-blue-500' },
  admin: { label: 'Admin', dot: 'bg-white ring-1 ring-ink/30' },
}

export function Brand({ className = '' }) {
  return (
    <Link to="/app" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <ShieldCheck size={20} />
      Rekha
    </Link>
  )
}

function visibleLinks(links, role) {
  return links.filter(([, , , allowed]) => !allowed || allowed(role))
}

function SideLink({ to, label, Icon }) {
  return (
    <NavLink to={to} end={to === '/app'}
      className={({ isActive }) => `relative flex items-center gap-2.5 px-2.5 h-8 rounded-md text-sm transition-colors ${
        isActive ? 'text-white' : 'text-white/55 hover:text-white'
      }`}>
      {({ isActive }) => (<>
        {isActive && (
          <motion.span layoutId="side-active" className="absolute inset-0 rounded-md bg-white/10"
            transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
        )}
        <Icon size={16} className="relative" /> <span className="relative">{label}</span>
      </>)}
    </NavLink>
  )
}

function RekhaSwitch() {
  const { rekhaOn, setRekhaOn } = useRekha()
  return (
    <button
      role="switch"
      aria-checked={rekhaOn}
      onClick={() => setRekhaOn((v) => !v)}
      className="flex items-center gap-2 text-sm font-medium rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <span className={`flex w-9 h-5 p-0.5 rounded-full transition-colors ${rekhaOn ? 'bg-ink justify-end' : 'bg-red-500 justify-start'}`}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className="w-4 h-4 rounded-full bg-white shadow" />
      </span>
      <span className={rekhaOn ? '' : 'text-red-600'}>Rekha {rekhaOn ? 'on' : 'off'}</span>
    </button>
  )
}

export default function Layout({ children }) {
  const { online, ledger, role, username, logout, model } = useRekha()
  const round = ledger.entries?.at(-1)?.round_id
  const me = roleInfo[role]

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-ink text-white">
        <div className="h-14 px-4 flex items-center border-b border-white/10"><Brand /></div>
        <nav className="flex-1 p-3 space-y-5">
          {sections.filter(([, links]) => visibleLinks(links, role).length).map(([heading, links]) => (
            <div key={heading}>
              <div className="px-2.5 mb-1 text-[11px] font-medium uppercase tracking-wider text-white/35">{heading}</div>
              {visibleLinks(links, role).map(([to, label, Icon]) => <SideLink key={to} to={to} label={label} Icon={Icon} />)}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2.5 h-9">
            <span className={`w-2 h-2 rounded-full ${me.dot}`} />
            <span className="flex-1 min-w-0 leading-tight">
              <span className="block text-sm truncate">{username || me.label}</span>
              <span className="block text-[11px] text-white/40">{me.label}</span>
            </span>
            <button onClick={logout} title="Log out" aria-label="Log out"
              className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
          <div className="px-2.5 mt-1 text-[11px] text-white/30">Team Gladiators · Hack in Hills '26</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-ink/[0.08]">
          <div className="h-14 px-4 md:px-8 flex items-center gap-4">
            <Brand className="md:hidden" />
            <div className="ml-auto flex items-center gap-4 md:gap-6 text-sm">
              {model && (
                <span className="hidden lg:flex items-center gap-1.5 text-ink/55" title={model.last_error || 'Model under test'}>
                  <Cpu size={14} /> <span className="mono text-xs text-ink">{model.using}</span>
                </span>
              )}
              <span className="hidden sm:inline text-ink/55">
                Round <span className="font-medium text-ink tabular-nums">{round ?? '—'}</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink/55" title={online ? 'Backend live' : 'Backend offline'}>
                <span className="relative flex w-2 h-2">
                  {online && <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />}
                  <span className={`relative w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`} />
                </span>
                <span className="hidden sm:inline">{online ? 'Backend live' : 'Backend offline'}</span>
              </span>
              {can.admin(role) && <RekhaSwitch />}
              <button onClick={logout} aria-label="Log out" className="md:hidden p-1.5 rounded-md text-ink/50 hover:bg-ink/5">
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <nav className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-4 pb-2">
            {sections.flatMap(([, links]) => visibleLinks(links, role)).map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/app'}
                className={({ isActive }) => `shrink-0 flex items-center gap-1.5 px-2.5 h-8 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-ink text-white' : 'text-ink/60 hover:bg-ink/5'
                }`}>
                <Icon size={15} /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  )
}
