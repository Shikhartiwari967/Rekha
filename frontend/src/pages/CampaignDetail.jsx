import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileCode2, Lock, CheckCircle2, XCircle, ShieldBan } from 'lucide-react'
import { Page, Card, Chip, Stat, Button, Empty, buttonClass } from '../components/ui'
import { StatusChip, Progress } from './Campaigns'
import { useRekha } from '../store'
import { api, downloadJson } from '../api'

function Verdict({ run }) {
  if (run.blocked) return <span className="text-ink/35">—</span>
  if (!('verdict_safe' in run)) return <span className="inline-flex items-center gap-1 text-ink/45"><Lock size={12} /> sealed</span>
  return run.verdict_safe
    ? <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={13} /> safe</span>
    : <span className="inline-flex items-center gap-1 text-red-600" title={run.verdict_reason}><XCircle size={13} /> {run.verdict_reason}</span>
}

export default function CampaignDetail() {
  const { id } = useParams()
  const { role, ledger } = useRekha()
  const [c, setC] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => api.campaign(id).then(setC).catch((e) => e.status === 404 && setMissing(true)), [id])
  useEffect(() => { load() }, [load])

  const live = c && (c.status === 'running' || c.status === 'queued')
  useEffect(() => {
    if (!live) return
    const t = setInterval(load, 800)
    return () => clearInterval(t)
  }, [live, load])

  const downloadReport = async () => {
    setError(null)
    try {
      downloadJson(await api.report(c.round_id), `rekha-round-${c.round_id}-report.json`)
    } catch (e) {
      setError(e.detail || 'Could not build the report.')
    }
  }

  if (missing) return <Page title="Campaign not found"><Link to="/app/campaigns" className={buttonClass()}>Back to campaigns</Link></Page>
  if (!c) return <Page title="Campaign"><Empty>Loading…</Empty></Page>

  const s = c.summary
  const done = c.status === 'done' || c.status === 'failed'

  return (
    <Page
      title={c.name}
      description={`Campaign #${c.id} · ${c.total} attacks · Rekha ${c.rekha_on ? 'on' : 'off'} · started by ${c.created_by}${c.round_id ? ` · round ${c.round_id}` : ''}`}
      actions={<>
        <Link to="/app/campaigns" className={buttonClass('ghost')}><ArrowLeft size={14} /> All campaigns</Link>
        {done && c.round_id && <Button onClick={downloadReport}><Download size={14} /> Signed report</Button>}
        <a href={api.verifyScriptUrl} download className={buttonClass()}><FileCode2 size={14} /> verify_report.py</a>
      </>}
    >
      <Card className="mb-4" bodyClassName="p-4 flex flex-wrap items-center gap-4">
        <StatusChip status={c.status} />
        <div className="flex-1 min-w-[160px]"><Progress value={s.completed} total={c.total} /></div>
        <span className="text-sm tabular-nums text-ink/60">{s.completed} / {c.total} attacks</span>
        {c.error && <span className="text-sm text-red-600 w-full">Failed: {c.error}</span>}
        {error && <span role="alert" className="text-sm text-red-600 w-full">{error}</span>}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Blocked by policy" value={s.blocked} hint="Never reached the model" />
        <Stat label="Reached the model" value={s.reached_model} hint="Slipped past the policy" />
        <Stat label="Model compromised" value={s.model_compromised ?? 'Sealed'}
          tone={s.model_compromised ? 'bad' : s.model_compromised === 0 ? 'good' : 'ink'}
          hint={role === 'red' ? 'Blue’s findings are hidden from red' : done ? 'Flagged by blue’s guard' : 'Revealed when the round closes'} />
        <Stat label="Leaked to red" value={s.leaked_to_red} tone={s.leaked_to_red ? 'bad' : 'good'}
          hint={c.rekha_on ? 'Rekha normalised every reply' : 'Rekha off: raw answers reached red'} />
      </div>

      <Card title="Attacks" bodyClassName="overflow-x-auto">
        {c.runs.length === 0 ? <Empty>Starting…</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-ink/50 border-b border-ink/10">
              <tr>
                <th className="text-left font-medium pl-4 pr-2 py-2.5">Attack</th>
                <th className="text-left font-medium px-2 py-2.5">Policy · model</th>
                <th className="text-left font-medium px-2 py-2.5">Blue verdict</th>
                <th className="text-left font-medium px-2 py-2.5">Red saw</th>
                <th className="text-right font-medium pr-4 py-2.5">Reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {c.runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="pl-4 pr-2 py-2.5 max-w-[300px]">
                    <div className="truncate" title={r.attack}>{r.attack}</div>
                    <div className="text-xs text-ink/40">{r.pack}</div>
                    {r.model_answer && <div className="text-xs text-ink/50 mt-1 line-clamp-2" title={r.model_answer}>↳ {r.model_answer}</div>}
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {r.blocked ? <Chip tone="bad"><ShieldBan size={12} /> {r.rule}</Chip> : <Chip>pass</Chip>}
                    {r.model && <div className="mono text-[11px] text-ink/45 mt-1">{r.model}</div>}
                  </td>
                  <td className="px-2 py-2.5 max-w-[240px]"><Verdict run={r} /></td>
                  <td className="px-2 py-2.5 mono text-xs max-w-[160px] truncate" title={r.red_reply}>{r.red_reply}</td>
                  <td className="pr-4 py-2.5 text-right tabular-nums text-ink/60 whitespace-nowrap">{Math.round(r.latency_ms)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {done && c.round_id && (
        <Card title="Verify this campaign yourself" className="mt-4">
          <p className="text-sm text-ink/60">
            Download the signed report and the script, then run this anywhere with Python and PyNaCl. It recomputes every
            hash and checks the Ed25519 signature against Rekha's published key. You don't have to trust this server.
          </p>
          <pre className="mt-3 rounded-lg bg-ink text-white/90 text-xs p-3 overflow-x-auto mono">
{`pip install pynacl
python verify_report.py rekha-round-${c.round_id}-report.json --key ${ledger.public_key || '<public key>'}`}
          </pre>
        </Card>
      )}
    </Page>
  )
}
