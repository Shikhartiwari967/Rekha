import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api, loadSession, saveSession, setOnUnauthorized } from './api'

const Ctx = createContext(null)
export const useRekha = () => useContext(Ctx)

// What each role may do; the backend enforces the same rules.
export const can = {
  attack: (role) => role === 'red' || role === 'admin',
  admin: (role) => role === 'admin',
  readVerdicts: (role) => role === 'blue' || role === 'admin',
}

const emptyLedger = { entries: [], checkpoints: [] }

export function RekhaProvider({ children }) {
  const [role, setRole] = useState(() => loadSession()?.role ?? null)
  const [username, setUsername] = useState(() => loadSession()?.username ?? null)
  const [demo, setDemo] = useState(false)       // stage-only Tamper/Reset enabled on this server?
  const [online, setOnline] = useState(null)   // backend reachable?
  const [rekhaOnChoice, setRekhaOn] = useState(true)
  const [lastRun, setLastRun] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [watchman, setWatchman] = useState([])
  const [ledger, setLedger] = useState(emptyLedger)
  const [verdicts, setVerdicts] = useState([])
  const [verifyState, setVerifyState] = useState(null)
  const [model, setModel] = useState(null)
  const [busy, setBusy] = useState(false)

  // Only the admin may switch Rekha off; everyone else always runs with it on.
  const rekhaOn = can.admin(role) ? rekhaOnChoice : true

  const logout = useCallback(() => {
    saveSession(null); setRole(null); setUsername(null)
    setLastRun(null); setMetrics(null); setWatchman([]); setLedger(emptyLedger)
    setVerdicts([]); setVerifyState(null); setModel(null); setRekhaOn(true)
  }, [])

  useEffect(() => { setOnUnauthorized(logout) }, [logout])

  const login = useCallback(async (name, password) => {
    const s = await api.login(name, password)
    saveSession(s); setRole(s.role); setUsername(s.username)
  }, [])

  const ping = useCallback(async () => {
    try {
      const [, cfg] = await Promise.all([api.health(), api.config()])
      setOnline(true); setDemo(cfg.demo)
    } catch { setOnline(false) }
  }, [])

  const refreshAll = useCallback(async () => {
    if (!role) return
    try {
      const [me, m, w, l, v, md] = await Promise.all([
        api.me(), api.metrics(), api.watchman(), api.ledger(),
        can.readVerdicts(role) ? api.verdicts() : { rounds: [] },
        api.model(),
      ])
      // An admin may have changed this account's role since login.
      if (me.role !== role) { saveSession({ ...loadSession(), role: me.role }); setRole(me.role) }
      setMetrics(m); setWatchman(w.alerts || []); setLedger(l); setVerdicts(v.rounds); setModel(md)
    } catch { /* backend offline or logged out */ }
  }, [role])

  const runAttack = useCallback(async (attack) => {
    setBusy(true)
    try {
      const out = await api.attack(attack, rekhaOn)
      setLastRun(out)
      setMetrics(out.metrics)
      setWatchman(out.watchman || [])
      await refreshAll()
      return out
    } finally { setBusy(false) }
  }, [rekhaOn, refreshAll])

  const closeRound = useCallback(async () => {
    const r = await api.closeRound()
    await refreshAll()
    return r
  }, [refreshAll])

  const verify = useCallback(async () => {
    const v = await api.verify(); setVerifyState(v); return v
  }, [])

  const tamper = useCallback(async (index) => {
    const r = await api.tamper(index); setVerifyState(r.verify); await refreshAll(); return r
  }, [refreshAll])

  const reset = useCallback(async () => {
    await api.reset(); setLastRun(null); setVerifyState(null)
    await api.openRound(); await refreshAll()
  }, [refreshAll])

  return (
    <Ctx.Provider value={{
      role, username, demo, login, logout,
      online, ping, rekhaOn, setRekhaOn,
      lastRun, metrics, watchman, ledger, verdicts, verifyState, model, busy,
      runAttack, closeRound, verify, tamper, reset, refreshAll,
    }}>
      {children}
    </Ctx.Provider>
  )
}
