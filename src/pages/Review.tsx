import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema.ts'
import { formatDate } from '../domain/dates.ts'
import { money } from '../domain/money.ts'
import { derivePattern } from '../domain/normalise.ts'
import { buildIndex, suggestFor } from '../domain/suggest.ts'
import type { Suggestion, Transaction } from '../domain/types.ts'
import { addRuleAndApply, previewRule, setCategory } from '../services/categorise.ts'
import { useAllTransactions, useCategories, useRules } from '../hooks.ts'
import { CategoryPicker, type CategoryValue } from '../components/CategoryPicker.tsx'
import { RuleEditor, emptyRule, type RuleDraft } from '../components/RuleEditor.tsx'
import { useToast } from '../components/Toast.tsx'

interface Group {
  key: string
  pattern: string
  txs: Transaction[]
  total: number
  suggestions: Suggestion[]
}

export default function Review() {
  const all = useAllTransactions()
  const categories = useCategories()
  const rules = useRules()
  const toast = useToast()
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [makeRule, setMakeRule] = useState(true)
  const [picking, setPicking] = useState<string | null>(null)
  const [picker, setPicker] = useState<CategoryValue>({ category: '', subcategory: '' })
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null)
  const [sort, setSort] = useState<'count' | 'amount' | 'recent'>('count')

  const index = useMemo(() => buildIndex({ categories, rules, history: all.filter((t) => t.category) }), [categories, rules, all])

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const t of all) {
      if (t.category) continue
      const pattern = derivePattern(t.description) || t.description
      const key = pattern.toLowerCase()
      let g = map.get(key)
      if (!g) {
        g = { key, pattern, txs: [], total: 0, suggestions: [] }
        map.set(key, g)
      }
      g.txs.push(t)
      g.total += t.amount
    }
    const out = [...map.values()]
    for (const g of out) g.suggestions = suggestFor(g.txs[0], index)
    out.sort((a, b) => (sort === 'count' ? b.txs.length - a.txs.length : sort === 'amount' ? Math.abs(b.total) - Math.abs(a.total) : b.txs[0].date.localeCompare(a.txs[0].date)))
    return out
  }, [all, index, sort])

  const visible = groups.filter((g) => !skipped.has(g.key))
  const remaining = groups.reduce((s, g) => s + g.txs.length, 0)

  async function assign(g: Group, category: string, subcategory: string) {
    if (!category) return
    if (makeRule) {
      const draft = emptyRule({ pattern: g.pattern, category, subcategory })
      const preview = previewRule({ ...draft, createdAt: '' }, all)
      if (preview.conflicting.length > 0) {
        // The derived pattern would re-categorise things already filed elsewhere: let the user see that first.
        setRuleDraft(draft)
        return
      }
      const { applied } = await addRuleAndApply(db, draft)
      toast(`Rule created · ${applied} transaction${applied === 1 ? '' : 's'} categorised as ${category}${subcategory ? ' / ' + subcategory : ''}`)
    } else {
      await setCategory(db, g.txs.map((t) => t.id!), category, subcategory)
      toast(`${g.txs.length} transaction${g.txs.length === 1 ? '' : 's'} categorised as ${category}${subcategory ? ' / ' + subcategory : ''}`)
    }
    setPicking(null)
  }

  if (groups.length === 0) {
    return (
      <div>
        <div className="page-head"><h1>Review</h1></div>
        <div className="card empty">
          <strong>Everything is categorised</strong>
          New transactions that no rule matches will show up here after your next <Link to="/import">import</Link>.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Review</h1>
          <div className="sub">{remaining} uncategorised transaction{remaining === 1 ? '' : 's'} in {groups.length} group{groups.length === 1 ? '' : 's'}. Pick a suggestion or choose a category; similar transactions are handled together.</div>
        </div>
        <div className="row">
          <label className="check small" title="When ticked, accepting a suggestion also creates a rule so future imports are categorised automatically">
            <input type="checkbox" checked={makeRule} onChange={(e) => setMakeRule(e.target.checked)} />
            Also create a rule
          </label>
          <div className="seg">
            <button className={sort === 'count' ? 'on' : ''} onClick={() => setSort('count')}>Most frequent</button>
            <button className={sort === 'amount' ? 'on' : ''} onClick={() => setSort('amount')}>Largest</button>
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>Newest</button>
          </div>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="card empty">
          You skipped every remaining group. <button className="ghost" onClick={() => setSkipped(new Set())}>Show them again</button>
        </div>
      )}

      {visible.slice(0, 40).map((g) => (
        <div className="group" key={g.key}>
          <div className="head">
            <div>
              <strong>{g.pattern}</strong>
              <span className="muted small" style={{ marginLeft: 8 }}>
                {g.txs.length} transaction{g.txs.length === 1 ? '' : 's'} · {money(g.total)} · {g.txs.length === 1 ? formatDate(g.txs[0].date) : `${formatDate(g.txs[g.txs.length - 1].date)} to ${formatDate(g.txs[0].date)}`}
              </span>
            </div>
            <div className="row">
              <button className="ghost small" onClick={() => setSkipped(new Set(skipped).add(g.key))}>Skip for now</button>
              <button className="small" onClick={() => setRuleDraft(emptyRule({ pattern: g.pattern }))}>Write rule…</button>
            </div>
          </div>
          {g.txs.length > 1 && (
            <div className="samples">
              {g.txs.slice(0, 2).map((t) => (
                <div key={t.id} className="truncate">{formatDate(t.date)} · {t.description} · {money(t.amount)}</div>
              ))}
              {g.txs.length > 2 && <div className="muted">… {g.txs.length - 2} more</div>}
            </div>
          )}
          {g.txs.length === 1 && g.txs[0].description !== g.pattern && <div className="samples truncate">{g.txs[0].description}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            {g.suggestions.map((s) => (
              <button className="sug" key={`${s.category}|${s.subcategory}`} onClick={() => assign(g, s.category, s.subcategory)} title={s.reason}>
                <span className="c">{s.category}{s.subcategory && <span className="muted"> / {s.subcategory}</span>}</span>
                <span className="r"><span className="conf"><i style={{ width: `${Math.round(s.confidence * 100)}%` }} /></span> {s.reason}</span>
              </button>
            ))}
            {picking === g.key ? (
              <div className="row">
                <CategoryPicker categories={categories} value={picker} onChange={setPicker} autoFocus />
                <button className="primary small" disabled={!picker.category} onClick={() => assign(g, picker.category, picker.subcategory)}>Apply</button>
                <button className="ghost small" onClick={() => setPicking(null)}>Cancel</button>
              </div>
            ) : (
              <button className="small" onClick={() => { setPicking(g.key); setPicker({ category: '', subcategory: '' }) }}>Choose category…</button>
            )}
          </div>
        </div>
      ))}
      {visible.length > 40 && <p className="muted small" style={{ marginTop: 12 }}>Showing the first 40 groups. Categorise some to see more.</p>}

      {ruleDraft && <RuleEditor initial={ruleDraft} transactions={all} onClose={() => setRuleDraft(null)} />}
    </div>
  )
}
