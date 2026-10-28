import { useEffect } from 'react'
import { motion, animate, useMotionValue, useTransform, useReducedMotion, AnimatePresence } from 'framer-motion'

// Shared motion: the page fades in and its cards rise in one after another.
// Cards that mount later (e.g. after a run) inherit the same entrance.
export const ease = [0.22, 1, 0.36, 1]
export const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
}

export function Page({ title, description, actions, children }) {
  return (
    <motion.main
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="w-full max-w-6xl mx-auto px-4 md:px-8 py-6"
    >
      <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-ink/55 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </motion.div>
      {children}
    </motion.main>
  )
}

export function Card({ title, action, className = '', bodyClassName = 'p-4', children }) {
  return (
    <motion.section variants={rise} className={`rounded-xl border border-ink/[0.08] bg-white shadow-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 h-11 border-b border-ink/[0.08]">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </motion.section>
  )
}

export function Chip({ children, tone = 'default', className = '' }) {
  const tones = {
    default: 'bg-ink/[0.04] text-ink/70 ring-ink/10',
    dark: 'bg-ink text-white ring-ink',
    good: 'bg-green-50 text-green-700 ring-green-600/20',
    bad: 'bg-red-50 text-red-700 ring-red-600/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

/** Counts from the previous value to the new one. */
export function AnimatedNumber({ value }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const shown = useTransform(mv, (v) => (Number.isInteger(value) ? Math.round(v) : v.toFixed(1)))
  useEffect(() => {
    if (reduce) { mv.set(value); return }
    const controls = animate(mv, value, { duration: 0.7, ease })
    return controls.stop
  }, [value, reduce, mv])
  return <motion.span>{shown}</motion.span>
}

export function Stat({ label, value, suffix, tone = 'ink', hint }) {
  const color = { ink: 'text-ink', good: 'text-green-600', bad: 'text-red-600' }[tone]
  return (
    <motion.div variants={rise} className="rounded-xl border border-ink/[0.08] bg-white shadow-card p-4">
      <div className="text-xs font-medium text-ink/55">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={value} className="inline-block"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}>
              {value}
            </motion.span>
          </AnimatePresence>
        )}
        {suffix && <span className="text-base font-medium text-ink/35 ml-0.5">{suffix}</span>}
      </div>
      {hint && <div className="text-xs text-ink/45 mt-1">{hint}</div>}
    </motion.div>
  )
}

export function buttonClass(variant = 'secondary') {
  const styles = {
    primary: 'bg-ink text-white border-transparent hover:bg-ink/85',
    secondary: 'bg-white text-ink border-ink/15 hover:bg-ink/[0.04] hover:border-ink/25',
    ghost: 'text-ink/55 border-transparent hover:bg-ink/[0.05] hover:text-ink',
    danger: 'bg-white text-red-600 border-red-200 hover:bg-red-50',
  }
  return `inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-1
    disabled:opacity-50 disabled:pointer-events-none ${styles[variant]}`
}

export function Button({ variant, className = '', ...props }) {
  return <motion.button whileTap={{ scale: 0.97 }} className={`${buttonClass(variant)} ${className}`} {...props} />
}

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

export function Empty({ children }) {
  return <p className="px-4 py-8 text-center text-sm text-ink/45">{children}</p>
}
