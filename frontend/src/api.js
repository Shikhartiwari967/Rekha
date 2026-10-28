// Thin client for the real Rekha backend. Vite proxies /api -> the backend.
const base = ''
const KEY = 'rekha_session'

// Session lives in sessionStorage: closing the tab logs you out.
export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) } catch { return null }
}
export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session))
    else sessionStorage.removeItem(KEY)
  } catch { /* storage blocked: session lasts until reload */ }
  token = session?.token ?? null
}

let token = loadSession()?.token ?? null
let onUnauthorized = () => {}
export const setOnUnauthorized = (fn) => { onUnauthorized = fn }

async function j(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && path !== '/api/auth/login') onUnauthorized()
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}`)
    err.status = res.status
    err.detail = await res.json().then((d) => d.detail).catch(() => null)
    throw err
  }
  return res.json()
}

export const api = {
  health: () => j('GET', '/api/health'),
  publicStats: () => j('GET', '/api/public/stats'),
  model: () => j('GET', '/api/model'),
  campaigns: () => j('GET', '/api/campaigns'),
  campaign: (id) => j('GET', `/api/campaigns/${id}`),
  createCampaign: (body) => j('POST', '/api/campaigns', body),
  runs: (limit = 50) => j('GET', `/api/runs?limit=${limit}`),
  report: (roundId) => j('GET', `/api/rounds/${roundId}/report`),
  login: (username, password) => j('POST', '/api/auth/login', { username, password }),
  config: () => j('GET', '/api/config'),
  users: () => j('GET', '/api/users'),
  createUser: (body) => j('POST', '/api/users', body),
  updateUser: (username, body) => j('PATCH', `/api/users/${encodeURIComponent(username)}`, body),
  me: () => j('GET', '/api/auth/me'),
  attacks: () => j('GET', '/api/attacks'),
  openRound: () => j('POST', '/api/round/open'),
  attack: (attack, rekha_on) => j('POST', '/api/attack', { attack, rekha_on }),
  verifyScriptUrl: '/api/public/verify_report.py',
  closeRound: () => j('POST', '/api/round/close'),
  verdicts: () => j('GET', '/api/verdicts'),
  ledger: () => j('GET', '/api/ledger'),
  verify: () => j('GET', '/api/ledger/verify'),
  tamper: (index, new_text = 'TAMPERED') =>
    j('POST', '/api/ledger/tamper', { index, new_text }),
  metrics: () => j('GET', '/api/metrics'),
  watchman: () => j('GET', '/api/watchman'),
  reset: () => j('POST', '/api/reset'),
}

/** Save any JSON as a file download in the browser. */
export function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
