import type { ExpenseDb } from '../db/schema.ts'
import type { Budget, Category, ImportBatch, MatchType, Rule, Transaction } from '../domain/types.ts'
import { ensureCategory } from './categories.ts'

export interface BackupFile {
  app: 'expense-tracker'
  version: 1
  exportedAt: string
  categories: Category[]
  rules: Rule[]
  transactions: Transaction[]
  budgets: Budget[]
  imports: ImportBatch[]
}

export async function exportBackup(db: ExpenseDb): Promise<BackupFile> {
  return {
    app: 'expense-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    rules: await db.rules.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    imports: await db.imports.toArray(),
  }
}

/** Replace everything with the contents of a backup file. */
export async function restoreBackup(db: ExpenseDb, data: BackupFile): Promise<void> {
  if (data.app !== 'expense-tracker') throw new Error('Not an Expense Tracker backup file')
  await db.transaction('rw', [db.categories, db.rules, db.transactions, db.budgets, db.imports], async () => {
    await Promise.all([db.categories.clear(), db.rules.clear(), db.transactions.clear(), db.budgets.clear(), db.imports.clear()])
    await db.categories.bulkAdd(data.categories)
    await db.rules.bulkAdd(data.rules)
    await db.transactions.bulkAdd(data.transactions)
    await db.budgets.bulkAdd(data.budgets)
    await db.imports.bulkAdd(data.imports ?? [])
  })
}

const MATCH_TYPES: MatchType[] = ['keywords', 'contains', 'startsWith', 'exact', 'regex']

export interface RuleImportRow {
  pattern: string
  matchType?: MatchType
  category: string
  subcategory?: string
  priority?: number
  enabled?: boolean
  amountMin?: number
  amountMax?: number
  notes?: string
}

/** Accept either a bare array of rules or an object with a `rules` array (including a full backup). */
export function parseRulesFile(json: unknown): RuleImportRow[] {
  const arr = Array.isArray(json) ? json : (json as { rules?: unknown })?.rules
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of rules or an object with a "rules" array')
  return arr.map((r, i) => {
    const row = r as Record<string, unknown>
    const pattern = String(row.pattern ?? row.item ?? '').trim()
    const category = String(row.category ?? '').trim()
    if (!pattern || !category) throw new Error(`Rule ${i + 1} needs a pattern and a category`)
    const mt = String(row.matchType ?? 'keywords') as MatchType
    return {
      pattern,
      matchType: MATCH_TYPES.includes(mt) ? mt : 'keywords',
      category,
      subcategory: String(row.subcategory ?? '').trim(),
      priority: typeof row.priority === 'number' ? row.priority : 100,
      enabled: row.enabled !== false,
      amountMin: typeof row.amountMin === 'number' ? row.amountMin : undefined,
      amountMax: typeof row.amountMax === 'number' ? row.amountMax : undefined,
      notes: typeof row.notes === 'string' ? row.notes : undefined,
    }
  })
}

/** Add rules from a file, skipping ones already present (same pattern, type, category and subcategory). */
export async function importRules(db: ExpenseDb, rows: RuleImportRow[]): Promise<{ added: number; skipped: number }> {
  const existing = await db.rules.toArray()
  const key = (r: { pattern: string; matchType?: string; category: string; subcategory?: string }) => `${r.matchType ?? 'keywords'}|${r.pattern.toLowerCase()}|${r.category}|${r.subcategory ?? ''}`
  const have = new Set(existing.map(key))
  let added = 0
  let skipped = 0
  const now = new Date().toISOString()
  for (const r of rows) {
    if (have.has(key(r))) {
      skipped++
      continue
    }
    have.add(key(r))
    await ensureCategory(db, r.category, r.subcategory ?? '')
    await db.rules.add({ pattern: r.pattern, matchType: r.matchType ?? 'keywords', category: r.category, subcategory: r.subcategory ?? '', priority: r.priority ?? 100, enabled: r.enabled ?? true, amountMin: r.amountMin, amountMax: r.amountMax, notes: r.notes, createdAt: now })
    added++
  }
  return { added, skipped }
}
