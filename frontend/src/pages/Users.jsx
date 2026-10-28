import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UserPlus, X } from 'lucide-react'
import { Page, Card, Chip, Button, Empty, ease } from '../components/ui'
import { useRekha } from '../store'
import { api } from '../api'

const ROLES = ['red', 'blue', 'admin']
const field = 'h-9 rounded-lg border border-ink/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/25'

function NewUser({ onDone, onClose }) {
  const [form, setForm] = useState({ username: '', password: '', role: 'red' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault(); setError(null)
    try { await api.createUser(form); onDone() } catch (err) { setError(err.detail || 'Could not create the account.') }
  }

  return (
    <motion.form onSubmit={submit} className="overflow-hidden"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease }}>
      <Card title="New account" className="mb-4"
        action={<button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-md text-ink/40 hover:bg-ink/5"><X size={15} /></button>}
        bodyClassName="p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="block font-medium mb-1.5">Username</span>
          <input required value={form.username} onChange={set('username')} placeholder="e.g. asha" className={field} /></label>
        <label className="text-sm"><span className="block font-medium mb-1.5">Password</span>
          <input required type="password" minLength={8} value={form.password} onChange={set('password')}
            placeholder="8+ characters" autoComplete="new-password" className={field} /></label>
        <label className="text-sm"><span className="block font-medium mb-1.5">Role</span>
          <select value={form.role} onChange={set('role')} className={field}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <Button type="submit" variant="primary"><UserPlus size={14} /> Create</Button>
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </Card>
    </motion.form>
  )
}

export default function Users() {
  const { username: me } = useRekha()
  const [users, setUsers] = useState(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => api.users().then((d) => setUsers(d.users)).catch(() => setUsers([])), [])
  useEffect(() => { load() }, [load])

  const update = async (name, body, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    setError(null)
    try { await api.updateUser(name, body); load() } catch (err) { setError(err.detail || 'Update failed.') }
  }

  const resetPassword = (name) => {
    const pw = window.prompt(`New password for ${name} (8+ characters):`)
    if (pw) update(name, { password: pw })
  }

  return (
    <Page title="Users" description="Personal accounts. Each person signs in with their own username; their role decides their room."
      actions={!open && <Button variant="primary" onClick={() => setOpen(true)}><UserPlus size={14} /> Add user</Button>}>
      <AnimatePresence>{open && <NewUser onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />}</AnimatePresence>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

      <Card bodyClassName="overflow-x-auto">
        {users === null ? <Empty>Loading…</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-ink/50 border-b border-ink/10">
              <tr>
                <th className="text-left font-medium pl-4 pr-2 py-2.5">User</th>
                <th className="text-left font-medium px-2 py-2.5">Role</th>
                <th className="text-left font-medium px-2 py-2.5">Status</th>
                <th className="text-left font-medium px-2 py-2.5">Created</th>
                <th className="pr-4" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {users.map((u) => (
                <tr key={u.username} className={u.disabled ? 'text-ink/40' : ''}>
                  <td className="pl-4 pr-2 py-2.5 font-medium">{u.username}{u.username === me && <span className="ml-2 text-xs text-ink/40">(you)</span>}</td>
                  <td className="px-2 py-2.5">
                    <select aria-label={`Role of ${u.username}`} value={u.role}
                      onChange={(e) => update(u.username, { role: e.target.value })}
                      className="h-8 rounded-md border border-ink/15 bg-white px-2 text-sm">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2.5">{u.disabled ? <Chip tone="bad">disabled</Chip> : <Chip tone="good">active</Chip>}</td>
                  <td className="px-2 py-2.5 text-ink/55 whitespace-nowrap">{new Date(u.created_at * 1000).toLocaleDateString()}</td>
                  <td className="pr-4 py-2.5 text-right whitespace-nowrap space-x-1">
                    <Button variant="ghost" className="h-8" onClick={() => resetPassword(u.username)}>Reset password</Button>
                    {u.disabled
                      ? <Button variant="ghost" className="h-8" onClick={() => update(u.username, { disabled: false })}>Enable</Button>
                      : <Button variant="danger" className="h-8" onClick={() => update(u.username, { disabled: true }, `Disable ${u.username}? They are signed out immediately.`)}>Disable</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Page>
  )
}
