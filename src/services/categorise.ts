import type { ExpenseDb } from '../db/schema.ts'
import { findMatchingRule, orderRules } from '../domain/rules.ts'
import type { Rule, Transaction } from '../domain/types.ts'
import { ensureCategory } from './categories.ts'

export type ApplyScope = 'uncategorised' | 'rules' | 'all'

export interface ApplyResult {
  examined: number
  changed: number
  cleared: number
}

/**
 * Re-run the rules. Scope controls what may change:
 *  - uncategorised: only transactions with no category
 *  - rules: also transactions a rule assigned earlier (manual choices are kept)
 *  - all: everything, including manual assignments
 */
export async function applyRules(db: ExpenseDb, scope: ApplyScope = 'uncategorised'): Promise<ApplyResult> {
  const ordered = orderRules(await db.rules.toArray())
  const all = await db.transactions.toArray()
  const result: ApplyResult = { examined: 0, changed: 0, cleared: 0 }
  const updates: { key: number; changes: Partial<Transaction> }[] = []
  for (const tx of all) {
    const eligible = scope === 'all' || (scope === 'rules' ? tx.source !== 'manual' && tx.source !== 'import' : !tx.category)
    if (!eligible) continue
    result.examined++
    const rule = findMatchingRule(ordered, tx)
    if (rule) {
      if (tx.category !== rule.category || tx.subcategory !== rule.subcategory || tx.ruleId !== rule.id) {
        updates.push({ key: tx.id!, changes: { category: rule.category, subcategory: rule.subcategory, source: 'rule', ruleId: rule.id } })
        result.changed++
      }
    } else if (tx.source === 'rule' && scope !== 'uncategorised') {
      updates.push({ key: tx.id!, changes: { category: null, subcategory: null, source: null, ruleId: undefined } })
      result.cleared++
    }
  }
  if (updates.length) await db.transactions.bulkUpdate(updates)
  return result
}

/** Manually set a transaction's category. */
export async function setCategory(db: ExpenseDb, ids: number[], category: string | null, subcategory = ''): Promise<void> {
  if (category) await ensureCategory(db, category, subcategory)
  await db.transactions.bulkUpdate(
    ids.map((id) => ({ key: id, changes: category ? { category, subcategory, source: 'manual' as const, ruleId: undefined } : { category: null, subcategory: null, source: null, ruleId: undefined } })),
  )
}

/** Create a rule and immediately apply it to uncategorised and rule-assigned transactions it matches. */
export async function addRuleAndApply(db: ExpenseDb, rule: Omit<Rule, 'id' | 'createdAt'>, opts: { overwriteManual?: boolean } = {}): Promise<{ id: number; applied: number }> {
  await ensureCategory(db, rule.category, rule.subcategory)
  const id = (await db.rules.add({ ...rule, createdAt: new Date().toISOString() })) as number
  const applied = await applyRules(db, opts.overwriteManual ? 'all' : 'rules')
  return { id, applied: applied.changed }
}

/** Which transactions would a rule hit, split by whether they already carry a different category. */
export function previewRule(rule: Rule, transactions: Transaction[]) {
  const ordered = orderRules([rule])
  const hits = transactions.filter((t) => findMatchingRule(ordered, t) !== null)
  const same = hits.filter((t) => t.category === rule.category && t.subcategory === rule.subcategory)
  const uncategorised = hits.filter((t) => !t.category)
  const conflicting = hits.filter((t) => t.category && (t.category !== rule.category || t.subcategory !== rule.subcategory))
  return { hits, same, uncategorised, conflicting }
}
