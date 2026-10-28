import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Unlock, Bot, Swords, Shield, Gavel } from 'lucide-react'

const INK = '#0A0A0A'
const LINE = '#E5E5E5'

function Room({ x, y, w, h, title, sub, icon, dot, sealed, active, strong }) {
  return (
    <g>
      <motion.rect
        x={x} y={y} width={w} height={h} rx="14" fill="#FFFFFF"
        initial={false}
        animate={{ stroke: active || strong ? INK : LINE, strokeWidth: active ? 2.5 : 1.5 }}
        transition={{ duration: 0.25 }}
        style={{ filter: active ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.12))' : 'none' }}
      />
      <foreignObject x={x} y={y} width={w} height={h}>
        <div className="h-full w-full p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink/70">
            {icon}
            {sealed !== undefined && (
              sealed ? <Lock size={15} className="text-ink/40" /> : <Unlock size={15} className="text-red-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight text-ink">
              {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}{title}
            </div>
            <div className="text-[11px] text-ink/45 mt-0.5">{sub}</div>
          </div>
        </div>
      </foreignObject>
    </g>
  )
}

/**
 * The rooms + referee + ledger strip.
 * `activeStep` (1..5) lights up the matching edge and room. `rekhaOn` changes seals.
 */
export default function RoomsDiagram({ activeStep = 0, rekhaOn = true, blocked = false }) {
  const edge = (n) => (activeStep === n ? 'flow-on animate-flowpulse' : 'flow-off')

  return (
    <svg viewBox="0 0 820 420" className="w-full">
      <defs>
        <marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#A3A3A3" />
        </marker>
      </defs>

      {/* 1: red -> referee */}
      <path d="M 210 120 H 300" fill="none" strokeWidth="2.5" className={edge(1)} markerEnd="url(#arr)" />
      {/* 3: referee -> model */}
      <path d="M 520 120 H 610" fill="none" strokeWidth="2.5" className={edge(3)} markerEnd="url(#arr)" />
      {/* 4: model -> blue */}
      <path d="M 690 200 V 300 H 520" fill="none" strokeWidth="2.5" className={edge(4)} markerEnd="url(#arr)" />
      {/* 4: blue -> referee (verdict sealed) */}
      <path d="M 410 300 V 190" fill="none" strokeWidth="2.5" strokeDasharray={rekhaOn ? '6 6' : '0'}
        className={rekhaOn ? edge(4) : 'stroke-red-400'} />
      {/* 5: referee -> red (padded reply) */}
      <path d="M 300 150 H 210" fill="none" strokeWidth="2.5" className={edge(5)} markerEnd="url(#arr)" />
      {/* ledger tap */}
      <path d="M 410 190 V 360" fill="none" strokeWidth="1.5" stroke={LINE} strokeDasharray="3 5" />

      <text x="255" y="108" textAnchor="middle" fontSize="11" fill="#A3A3A3">no peeking</text>
      <text x="565" y="108" textAnchor="middle" fontSize="11" fill="#A3A3A3">no guessing</text>

      <Room x={40} y={70} w={170} h={110} title="Red room" sub="writes attacks" dot="bg-red-500"
        icon={<Swords size={16} />} active={activeStep === 5} />
      <Room x={300} y={70} w={220} h={110} title="The Referee" sub="the only door" strong
        icon={<Gavel size={16} />} active={activeStep === 1 || activeStep === 2} />
      <Room x={610} y={70} w={170} h={110} title="Model room" sub="fresh ctx · salted cache"
        icon={<Bot size={16} />} active={activeStep === 3} />
      <Room x={300} y={250} w={220} h={100} title="Blue guard room" dot="bg-blue-500"
        sub={rekhaOn ? 'verdict sealed' : 'verdict LEAKING'}
        icon={<Shield size={16} />} sealed={rekhaOn} active={activeStep === 4} />

      {/* referee inner chips */}
      <foreignObject x={340} y={78} width={172} height={24}>
        <div className="flex justify-end gap-1 text-[10px]">
          {['policy', 'sealed', 'padded'].map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded bg-ink/[0.04] border border-ink/10 text-ink/60">{t}</span>
          ))}
        </div>
      </foreignObject>

      {/* ledger strip */}
      <rect x={300} y={360} width={220} height={40} rx="10" fill="#F5F5F5" stroke={LINE} strokeWidth="1.5" />
      <text x={410} y={385} textAnchor="middle" fontSize="13" fontWeight="500" fill="#404040">Ledger · hashed + signed</text>

      <AnimatePresence>
        {blocked && (
          <motion.foreignObject x={300} y={30} width={220} height={32}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="h-full flex items-center justify-center">
              <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="px-2 py-1 rounded-full bg-red-600 text-white text-[11px] font-bold shadow">
                BLOCKED at door
              </motion.span>
            </div>
          </motion.foreignObject>
        )}
      </AnimatePresence>
    </svg>
  )
}
