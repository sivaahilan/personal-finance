import type { Budget, Category, Transaction } from '../domain/types.ts'

export interface SubLine {
  subcategory: string
  actual: number
  budget: number | null
}

export interface BudgetLine {
  category: string
  type: Category['type']
  /** Positive number: money spent (or earned for income). */
  actual: number
  /** null when nothing is budgeted at any level. */
  budget: number | null
  /** Where the category budget came from. */
  budgetSource: 'month' | 'default' | 'subcategories' | null
  subs: SubLine[]
}

/** Resolve the budget for a category/subcategory in a month: explicit month entry wins over the default. */
export function resolveBudget(budgets: Budget[], category: string, subcategory: string, month: string): { amount: number; source: 'month' | 'default' } | null {
  const monthEntry = budgets.find((b) => b.category === category && b.subcategory === subcategory && b.month === month)
  if (monthEntry) return { amount: monthEntry.amount, source: 'month' }
  const def = budgets.find((b) => b.category === category && b.subcategory === subcategory && b.month === 'default')
  if (def) return { amount: def.amount, source: 'default' }
  return null
}

/** Sign convention: expenses are stored negative; we report spend as positive. */
function spend(type: Category['type'], amount: number): number {
  return type === 'income' ? amount : -amount
}

export function buildBudgetLines(categories: Category[], budgets: Budget[], transactions: Transaction[], month: string): BudgetLine[] {
  const byCat = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (t.month !== month || !t.category) continue
    const list = byCat.get(t.category) ?? []
    list.push(t)
    byCat.set(t.category, list)
  }
  const lines: BudgetLine[] = []
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const cat of sorted) {
    const txs = byCat.get(cat.name) ?? []
    const actual = txs.reduce((s, t) => s + spend(cat.type, t.amount), 0)
    const subNames = new Set<string>(cat.subcategories)
    for (const t of txs) subNames.add(t.subcategory ?? '')
    for (const b of budgets) if (b.category === cat.name && b.subcategory) subNames.add(b.subcategory)
    const subs: SubLine[] = [...subNames]
      .filter((s) => s !== '' || txs.some((t) => !t.subcategory))
      .map((s) => ({
        subcategory: s,
        actual: txs.filter((t) => (t.subcategory ?? '') === s).reduce((sum, t) => sum + spend(cat.type, t.amount), 0),
        budget: s ? resolveBudget(budgets, cat.name, s, month)?.amount ?? null : null,
      }))
      .filter((s) => s.actual !== 0 || s.budget !== null)
      .sort((a, b) => b.actual - a.actual)
    const own = resolveBudget(budgets, cat.name, '', month)
    let budget: number | null = null
    let budgetSource: BudgetLine['budgetSource'] = null
    if (own) {
      budget = own.amount
      budgetSource = own.source
    } else if (subs.some((s) => s.budget !== null)) {
      budget = subs.reduce((s, x) => s + (x.budget ?? 0), 0)
      budgetSource = 'subcategories'
    }
    if (actual !== 0 || budget !== null) lines.push({ category: cat.name, type: cat.type, actual, budget, budgetSource, subs })
  }
  // Transactions in categories that no longer exist still count.
  for (const [name, txs] of byCat) {
    if (sorted.some((c) => c.name === name)) continue
    lines.push({ category: name, type: 'expense', actual: txs.reduce((s, t) => s - t.amount, 0), budget: null, budgetSource: null, subs: [] })
  }
  return lines
}

export function totals(lines: BudgetLine[]) {
  const expense = lines.filter((l) => l.type === 'expense')
  const income = lines.filter((l) => l.type === 'income')
  return {
    spent: expense.reduce((s, l) => s + l.actual, 0),
    budgeted: expense.reduce((s, l) => s + (l.budget ?? 0), 0),
    hasBudget: expense.some((l) => l.budget !== null),
    income: income.reduce((s, l) => s + l.actual, 0),
  }
}
