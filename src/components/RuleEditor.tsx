import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/schema.ts'
import type { MatchType, Rule, Transaction } from '../domain/types.ts'
import { compileRegex } from '../domain/rules.ts'
import { previewRule, applyRules } from '../services/categorise.ts'
import { ensureCategory } from '../services/categories.ts'
import { useCategories } from '../hooks.ts'
import { CategoryPicker } from './CategoryPicker.tsx'
import { Modal } from './Modal.tsx'
import { useToast } from './Toast.tsx'
import { money } from '../domain/money.ts'
import { formatDate } from '../domain/dates.ts'

const MATCH_LABELS: Record<MatchType, string> = {
  keywords: 'Contains all these words (any order)',
  contains: 'Contains this text',
  startsWith: 'Starts with this text',
  exact: 'Matches exactly',
  regex: 'Regular expression',
}

export type RuleDraft = Omit<Rule, 'id' | 'createdAt'> & { id?: number }

export function emptyRule(over: Partial<RuleDraft> = {}): RuleDraft {
  return { pattern: '', matchType: 'keywords', category: '', subcategory: '', priority: 100, enabled: true, ...over }
}

export function RuleEditor({ initial, transactions, onClose, onSaved }: { initial: RuleDraft; transactions: Transaction[]; onClose: () => void; onSaved?: (id: number) => void }) {
  const categories = useCategories()
  const toast = useToast()
  const [draft, setDraft] = useState<RuleDraft>(initial)
  const [overwriteManual, setOverwriteManual] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(initial), [initial])

  const regexError = draft.matchType === 'regex' && draft.pattern && !compileRegex(draft.pattern)
  const preview = useMemo(() => previewRule({ ...draft, createdAt: '' }, transactions), [draft, transactions])

  async function save() {
    if (!draft.pattern.trim() || !draft.category) return
    setSaving(true)
    try {
      await ensureCategory(db, draft.category, draft.subcategory)
      const body = { ...draft, pattern: draft.pattern.trim(), subcategory: draft.subcategory.trim() }
      let id: number
      if (draft.id) {
        id = draft.id
        const { id: _omit, ...changes } = body
        void _omit
        await db.rules.update(id, changes)
      } else {
        const { id: _omit, ...rest } = body
        void _omit
        id = (await db.rules.add({ ...rest, createdAt: new Date().toISOString() })) as number
      }
      const res = await applyRules(db, overwriteManual ? 'all' : 'rules')
      toast(res.changed ? `Rule saved and applied to ${res.changed} transaction${res.changed === 1 ? '' : 's'}` : 'Rule saved')
      onSaved?.(id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={draft.id ? 'Edit rule' : 'New rule'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Match type
          <select value={draft.matchType} onChange={(e) => setDraft({ ...draft, matchType: e.target.value as MatchType })}>
            {(Object.keys(MATCH_LABELS) as MatchType[]).map((k) => (
              <option key={k} value={k}>{MATCH_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Pattern
          <input value={draft.pattern} autoFocus onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} placeholder="e.g. WOOLWORTHS GORDON" />
          {regexError && <span className="small over">That regular expression is not valid.</span>}
        </label>
        <div className="field">
          <span>Assign to</span>
          <CategoryPicker categories={categories} value={{ category: draft.category, subcategory: draft.subcategory }} onChange={(v) => setDraft({ ...draft, ...v })} />
        </div>
        <details>
          <summary className="small">Advanced: priority and amount limits</summary>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <label className="field">
              Priority (lower runs first)
              <input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 100 })} />
            </label>
            <label className="field">
              Min amount (signed)
              <input type="number" step="0.01" value={draft.amountMin ?? ''} onChange={(e) => setDraft({ ...draft, amountMin: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </label>
            <label className="field">
              Max amount (signed)
              <input type="number" step="0.01" value={draft.amountMax ?? ''} onChange={(e) => setDraft({ ...draft, amountMax: e.target.value === '' ? undefined : Number(e.target.value) })} />
            </label>
            <label className="field">
              Notes
              <input value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>Amounts are signed: money out is negative. Leave blank for no limit.</p>
        </details>

        <div className="notice">
          <div className="row between">
            <strong>Matches {preview.hits.length} existing transaction{preview.hits.length === 1 ? '' : 's'}</strong>
            <span className="small muted">{preview.uncategorised.length} uncategorised · {preview.same.length} already this category · {preview.conflicting.length} categorised differently</span>
          </div>
          {preview.hits.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
              <table>
                <tbody>
                  {preview.hits.slice(0, 30).map((t) => (
                    <tr key={t.id}>
                      <td className="nowrap small">{formatDate(t.date)}</td>
                      <td className="desc truncate small">{t.description}</td>
                      <td className="num small">{money(t.amount)}</td>
                      <td className="small muted nowrap">{t.category ? `${t.category}${t.subcategory ? ' / ' + t.subcategory : ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.conflicting.some((t) => t.source === 'manual' || t.source === 'import') && (
            <label className="check small" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={overwriteManual} onChange={(e) => setOverwriteManual(e.target.checked)} />
              Also overwrite transactions I categorised by hand
            </label>
          )}
        </div>
      </div>
      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={saving || !draft.pattern.trim() || !draft.category || !!regexError} onClick={save}>
          {draft.id ? 'Save rule' : 'Create rule'}
        </button>
      </div>
    </Modal>
  )
}
