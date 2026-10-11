import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema.ts'
import { DEFAULT_CATEGORIES } from '../db/seed.ts'
import type { Category, CategoryType } from '../domain/types.ts'
import { deleteCategory, ensureCategory, renameCategory, renameSubcategory } from '../services/categories.ts'
import { exportBackup, restoreBackup, type BackupFile } from '../services/backup.ts'
import { downloadJson } from '../services/download.ts'
import { useCategories, useCategoryColours } from '../hooks.ts'
import { useToast } from '../components/Toast.tsx'

export default function Settings() {
  const categories = useCategories()
  const colour = useCategoryColours(categories)
  const toast = useToast()
  const counts = useLiveQuery(async () => ({ tx: await db.transactions.count(), rules: await db.rules.count(), budgets: await db.budgets.count() }), [], { tx: 0, rules: 0, budgets: 0 })
  const usage = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.transactions.each((t) => { if (t.category) m.set(t.category, (m.get(t.category) ?? 0) + 1) })
    return m
  }, [], new Map<string, number>())
  const [newCat, setNewCat] = useState('')
  const [newSub, setNewSub] = useState<Record<string, string>>({})
  const restoreRef = useRef<HTMLInputElement>(null)

  async function addCategory() {
    const name = newCat.trim()
    if (!name) return
    await ensureCategory(db, name)
    setNewCat('')
  }
  async function rename(c: Category) {
    const to = window.prompt('Rename category', c.name)?.trim()
    if (to && to !== c.name) await renameCategory(db, c.name, to)
  }
  async function remove(c: Category) {
    const n = usage.get(c.name) ?? 0
    if (!window.confirm(`Delete "${c.name}"? ${n} transaction${n === 1 ? '' : 's'} will become uncategorised and its rules and budgets will be removed.`)) return
    await deleteCategory(db, c.name)
  }
  async function setType(c: Category, type: CategoryType) {
    await db.categories.update(c.id!, { type })
  }
  async function move(c: Category, dir: -1 | 1) {
    const i = categories.findIndex((x) => x.id === c.id)
    const j = i + dir
    if (j < 0 || j >= categories.length) return
    const other = categories[j]
    await db.transaction('rw', db.categories, async () => {
      await db.categories.update(c.id!, { sortOrder: other.sortOrder })
      await db.categories.update(other.id!, { sortOrder: c.sortOrder })
    })
  }
  async function addSub(c: Category) {
    const s = (newSub[c.name] ?? '').trim()
    if (!s) return
    await ensureCategory(db, c.name, s)
    setNewSub({ ...newSub, [c.name]: '' })
  }
  async function renameSub(c: Category, s: string) {
    const to = window.prompt('Rename subcategory', s)?.trim()
    if (to && to !== s) await renameSubcategory(db, c.name, s, to)
  }
  async function removeSub(c: Category, s: string) {
    const n = await db.transactions.where('[category+subcategory]').equals([c.name, s]).count()
    if (!window.confirm(`Remove subcategory "${s}" from ${c.name}? ${n} transaction${n === 1 ? '' : 's'} will keep the category but lose the subcategory.`)) return
    await db.transaction('rw', [db.categories, db.transactions, db.rules, db.budgets], async () => {
      await db.categories.update(c.id!, { subcategories: c.subcategories.filter((x) => x !== s) })
      await db.transactions.where('[category+subcategory]').equals([c.name, s]).modify({ subcategory: '' })
      await db.rules.filter((r) => r.category === c.name && r.subcategory === s).modify({ subcategory: '' })
      await db.budgets.filter((b) => b.category === c.name && b.subcategory === s).delete()
    })
  }
  async function backup() {
    downloadJson(`expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup(db))
  }
  async function restore(file: File) {
    try {
      const data = JSON.parse(await file.text()) as BackupFile
      if (!window.confirm(`Replace everything in this browser with the backup from ${data.exportedAt?.slice(0, 10) ?? 'unknown date'} (${data.transactions?.length ?? 0} transactions)?`)) return
      await restoreBackup(db, data)
      toast('Backup restored')
    } catch (e) {
      toast(`Could not restore: ${(e as Error).message}`)
    }
  }
  async function clearAll() {
    if (window.prompt('This deletes every transaction, rule, budget and category in this browser. Type DELETE to confirm.') !== 'DELETE') return
    await db.transaction('rw', [db.categories, db.rules, db.transactions, db.budgets, db.imports], async () => {
      await Promise.all([db.transactions.clear(), db.rules.clear(), db.budgets.clear(), db.imports.clear(), db.categories.clear()])
      await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[])
    })
    toast('All data cleared')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">{counts.tx} transactions · {counts.rules} rules · {counts.budgets} budget entries, stored in this browser only.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Backup and restore</h2>
        </div>
        <p className="ink2">Everything lives in your browser's local database. Download a backup now and then, and restore it on a new device or after clearing browser data.</p>
        <div className="row">
          <button className="primary" onClick={backup}>Download backup</button>
          <input ref={restoreRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && void restore(e.target.files[0])} />
          <button onClick={() => restoreRef.current?.click()}>Restore backup…</button>
          <div className="spacer" />
          <button className="danger" onClick={clearAll}>Clear all data</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Categories</h2>
          <div className="row">
            <input placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
            <button onClick={addCategory} disabled={!newCat.trim()}>Add</button>
          </div>
        </div>
        <p className="small muted">Income categories count towards income, transfers are left out of budgets and reports totals, and everything else is spending. The first eight categories get their own chart colours.</p>
        <div className="stack">
          {categories.map((c, i) => (
            <div className="group" key={c.id}>
              <div className="head">
                <div className="row">
                  <span className="cat-cell" style={{ cursor: 'default' }}><span className="dot" style={{ background: colour(c.name) }} /><b>{c.name}</b></span>
                  <span className="small muted">{usage.get(c.name) ?? 0} transactions</span>
                </div>
                <div className="row">
                  <select value={c.type} onChange={(e) => setType(c, e.target.value as CategoryType)} aria-label="Category type">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <button className="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(c, -1)}>↑</button>
                  <button className="icon" aria-label="Move down" disabled={i === categories.length - 1} onClick={() => move(c, 1)}>↓</button>
                  <button className="small" onClick={() => rename(c)}>Rename</button>
                  <button className="small danger" onClick={() => remove(c)}>Delete</button>
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                {c.subcategories.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                    <button className="ghost icon small" aria-label={`Rename ${s}`} title="Rename" onClick={() => renameSub(c, s)}>✎</button>
                    <button className="ghost icon small" aria-label={`Remove ${s}`} title="Remove" onClick={() => removeSub(c, s)}>×</button>
                  </span>
                ))}
                <input placeholder="Add subcategory" value={newSub[c.name] ?? ''} onChange={(e) => setNewSub({ ...newSub, [c.name]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addSub(c)} style={{ width: 160 }} className="small" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
