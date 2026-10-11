import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../db/schema.ts'
import { formatDate, monthLabel } from '../domain/dates.ts'
import { money } from '../domain/money.ts'
import { derivePattern } from '../domain/normalise.ts'
import type { Transaction } from '../domain/types.ts'
import { setCategory } from '../services/categorise.ts'
import { useAllTransactions, useAvailableMonths, useCategories, useCategoryColours } from '../hooks.ts'
import { CategoryCell } from '../components/CategoryCell.tsx'
import { CategoryPicker, type CategoryValue } from '../components/CategoryPicker.tsx'
import { Modal } from '../components/Modal.tsx'
import { RuleEditor, emptyRule, type RuleDraft } from '../components/RuleEditor.tsx'
import { useToast } from '../components/Toast.tsx'

const PAGE = 100

export default function Transactions() {
  const all = useAllTransactions()
  const months = useAvailableMonths()
  const categories = useCategories()
  const colour = useCategoryColours(categories)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? ''
  const category = params.get('category') ?? ''
  const only = params.get('only') ?? ''
  const q = params.get('q') ?? ''
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<Transaction[] | null>(null)
  const [picker, setPicker] = useState<CategoryValue>({ category: '', subcategory: '' })
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null)

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    setPage(0)
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((t) => {
      if (month && t.month !== month) return false
      if (category === '__none__' ? t.category : category && t.category !== category) return false
      if (only === 'manual' && t.source !== 'manual') return false
      if (needle && !t.normalised.includes(needle) && !(t.category ?? '').toLowerCase().includes(needle) && !(t.subcategory ?? '').toLowerCase().includes(needle)) return false
      return true
    })
  }, [all, month, category, only, q])
  useEffect(() => setSelected(new Set()), [filtered.length, month, category, q])

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const sum = filtered.reduce((s, t) => s + t.amount, 0)
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((t) => selected.has(t.id!))

  function openEdit(txs: Transaction[]) {
    setEditing(txs)
    setPicker({ category: txs[0].category ?? '', subcategory: txs[0].subcategory ?? '' })
  }
  async function saveEdit() {
    if (!editing) return
    await setCategory(db, editing.map((t) => t.id!), picker.category || null, picker.subcategory)
    toast(`${editing.length} transaction${editing.length === 1 ? '' : 's'} updated`)
    setEditing(null)
    setSelected(new Set())
  }
  function makeRule(t: Transaction) {
    setRuleDraft(emptyRule({ pattern: derivePattern(t.description), category: t.category ?? '', subcategory: t.subcategory ?? '' }))
  }
  async function remove(ids: number[]) {
    if (!window.confirm(`Delete ${ids.length} transaction${ids.length === 1 ? '' : 's'}? They will come back if you import the same file again.`)) return
    await db.transactions.bulkDelete(ids)
    setSelected(new Set())
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <div className="sub">{filtered.length} shown · net {money(sum)}</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Search descriptions…" value={q} onChange={(e) => setParam('q', e.target.value)} style={{ width: 240 }} />
          <select value={month} onChange={(e) => setParam('month', e.target.value)} aria-label="Month">
            <option value="">All months</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={category} onChange={(e) => setParam('category', e.target.value)} aria-label="Category filter">
            <option value="">All categories</option>
            <option value="__none__">Uncategorised</option>
            {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <label className="check small">
            <input type="checkbox" checked={only === 'manual'} onChange={(e) => setParam('only', e.target.checked ? 'manual' : '')} />
            Manually categorised only
          </label>
          <div className="spacer" />
          {selected.size > 0 && (
            <div className="row">
              <span className="badge accent">{selected.size} selected</span>
              <button className="small" onClick={() => openEdit(filtered.filter((t) => selected.has(t.id!)))}>Set category</button>
              <button className="small danger" onClick={() => remove([...selected])}>Delete</button>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input type="checkbox" aria-label="Select page" checked={allOnPageSelected} onChange={(e) => {
                    const next = new Set(selected)
                    pageRows.forEach((t) => (e.target.checked ? next.add(t.id!) : next.delete(t.id!)))
                    setSelected(next)
                  }} />
                </th>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th>Category</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr><td colSpan={6} className="empty">No transactions match.</td></tr>
              )}
              {pageRows.map((t) => (
                <tr key={t.id} className={selected.has(t.id!) ? 'selected' : ''}>
                  <td>
                    <input type="checkbox" aria-label="Select" checked={selected.has(t.id!)} onChange={(e) => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(t.id!)
                      else next.delete(t.id!)
                      setSelected(next)
                    }} />
                  </td>
                  <td className="nowrap">{formatDate(t.date)}</td>
                  <td className="desc" title={t.description}>
                    <div className="truncate">{t.description}</div>
                  </td>
                  <td className={`num ${t.amount > 0 ? 'pos' : ''}`}>{money(t.amount)}</td>
                  <td>
                    <CategoryCell category={t.category} subcategory={t.subcategory} colour={colour(t.category)} onClick={() => openEdit([t])} />
                    {t.source === 'manual' && <span className="badge" style={{ marginLeft: 6 }} title="Set by hand">manual</span>}
                  </td>
                  <td className="nowrap">
                    <button className="ghost small" title="Create a rule from this transaction" onClick={() => makeRule(t)}>Rule</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE && (
          <div className="pager">
            <span className="small muted">Page {page + 1} of {Math.ceil(filtered.length / PAGE)}</span>
            <button className="small" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="small" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.length === 1 ? 'Categorise transaction' : `Categorise ${editing.length} transactions`} onClose={() => setEditing(null)}>
          {editing.length === 1 && (
            <p className="ink2" style={{ marginBottom: 12 }}>{formatDate(editing[0].date)} · {editing[0].description} · <b>{money(editing[0].amount)}</b></p>
          )}
          <CategoryPicker categories={categories} value={picker} onChange={setPicker} autoFocus />
          <div className="actions">
            {editing.length === 1 && (
              <button onClick={() => { const t = editing[0]; setEditing(null); setRuleDraft(emptyRule({ pattern: derivePattern(t.description), category: picker.category, subcategory: picker.subcategory })) }}>
                Create rule instead…
              </button>
            )}
            <button onClick={() => { void setCategory(db, editing.map((t) => t.id!), null); setEditing(null) }}>Clear</button>
            <button className="primary" disabled={!picker.category} onClick={saveEdit}>Save</button>
          </div>
        </Modal>
      )}
      {ruleDraft && <RuleEditor initial={ruleDraft} transactions={all} onClose={() => setRuleDraft(null)} />}
    </div>
  )
}
