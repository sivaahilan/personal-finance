import { useMemo, useRef, useState } from 'react'
import { db } from '../db/schema.ts'
import type { MatchType, Rule } from '../domain/types.ts'
import { applyRules, type ApplyScope } from '../services/categorise.ts'
import { importRules, parseRulesFile } from '../services/backup.ts'
import { useAllTransactions, useCategories, useCategoryColours, useRules } from '../hooks.ts'
import { RuleEditor, emptyRule, type RuleDraft } from '../components/RuleEditor.tsx'
import { useToast } from '../components/Toast.tsx'
import { downloadJson } from '../services/download.ts'

const TYPE_LABEL: Record<MatchType, string> = { keywords: 'all words', contains: 'contains', startsWith: 'starts with', exact: 'exact', regex: 'regex' }

export default function Rules() {
  const rules = useRules()
  const all = useAllTransactions()
  const categories = useCategories()
  const colour = useCategoryColours(categories)
  const toast = useToast()
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<RuleDraft | null>(null)
  const [scope, setScope] = useState<ApplyScope>('uncategorised')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of all) if (t.ruleId !== undefined) m.set(t.ruleId, (m.get(t.ruleId) ?? 0) + 1)
    return m
  }, [all])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rules.filter((r) => !needle || r.pattern.toLowerCase().includes(needle) || r.category.toLowerCase().includes(needle) || r.subcategory.toLowerCase().includes(needle))
  }, [rules, q])

  async function reapply() {
    setBusy(true)
    try {
      const r = await applyRules(db, scope)
      toast(`Checked ${r.examined} transactions: ${r.changed} categorised, ${r.cleared} cleared`)
    } finally {
      setBusy(false)
    }
  }
  async function onImportFile(file: File) {
    try {
      const rows = parseRulesFile(JSON.parse(await file.text()))
      const res = await importRules(db, rows)
      const applied = await applyRules(db, 'uncategorised')
      toast(`${res.added} rules added (${res.skipped} already existed) · ${applied.changed} transactions categorised`)
    } catch (e) {
      toast(`Could not import rules: ${(e as Error).message}`)
    }
  }
  async function toggle(r: Rule) {
    await db.rules.update(r.id!, { enabled: !r.enabled })
  }
  async function remove(r: Rule) {
    if (!window.confirm(`Delete the rule "${r.pattern}"? Transactions it categorised keep their category until you re-apply rules.`)) return
    await db.rules.delete(r.id!)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Rules</h1>
          <div className="sub">Rules run in priority order (lowest number first); the most specific pattern wins a tie. {rules.length} rule{rules.length === 1 ? '' : 's'}.</div>
        </div>
        <div className="row">
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && void onImportFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()}>Import rules</button>
          <button onClick={() => downloadJson(`expense-rules-${new Date().toISOString().slice(0, 10)}.json`, { rules })} disabled={rules.length === 0}>Export rules</button>
          <button className="primary" onClick={() => setDraft(emptyRule())}>New rule</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Filter rules…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <div className="spacer" />
          <span className="small muted">Re-apply to</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as ApplyScope)} aria-label="Re-apply scope">
            <option value="uncategorised">uncategorised only</option>
            <option value="rules">everything except manual</option>
            <option value="all">everything, including manual</option>
          </select>
          <button onClick={reapply} disabled={busy || rules.length === 0}>Re-apply rules</button>
        </div>
        {rules.length === 0 ? (
          <div className="empty">
            <strong>No rules yet</strong>
            Create rules from the Review page as you categorise, import a rules file, or add one by hand.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Pattern</th><th>Match</th><th>Category</th><th className="num">Priority</th><th className="num">Assigned</th><th>On</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                    <td className="desc"><span className="clickable" onClick={() => setDraft({ ...r })}>{r.pattern}</span>{(r.amountMin !== undefined || r.amountMax !== undefined) && <span className="badge" style={{ marginLeft: 6 }}>amount</span>}</td>
                    <td className="small muted nowrap">{TYPE_LABEL[r.matchType]}</td>
                    <td className="nowrap">
                      <span className="cat-cell" style={{ cursor: 'default' }}><span className="dot" style={{ background: colour(r.category) }} />{r.category}{r.subcategory && <span className="sub">/ {r.subcategory}</span>}</span>
                    </td>
                    <td className="num">{r.priority}</td>
                    <td className="num">{hits.get(r.id!) ?? 0}</td>
                    <td><input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} aria-label="Enabled" /></td>
                    <td className="nowrap">
                      <button className="ghost small" onClick={() => setDraft({ ...r })}>Edit</button>
                      <button className="ghost small danger" onClick={() => remove(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {draft && <RuleEditor initial={draft} transactions={all} onClose={() => setDraft(null)} />}
    </div>
  )
}
