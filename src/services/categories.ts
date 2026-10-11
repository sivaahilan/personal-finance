import type { ExpenseDb } from '../db/schema.ts'
import type { Category, CategoryType } from '../domain/types.ts'

/** Make sure a category (and optional subcategory) exists, creating as needed. */
export async function ensureCategory(db: ExpenseDb, name: string, subcategory = '', type: CategoryType = 'expense'): Promise<Category> {
  const trimmed = name.trim()
  let cat = await db.categories.where('name').equals(trimmed).first()
  if (!cat) {
    const max = (await db.categories.orderBy('sortOrder').last())?.sortOrder ?? 0
    const id = await db.categories.add({ name: trimmed, type, subcategories: [], sortOrder: max + 10 })
    cat = { id, name: trimmed, type, subcategories: [], sortOrder: max + 10 }
  }
  const sub = subcategory.trim()
  if (sub && !cat.subcategories.includes(sub)) {
    cat.subcategories = [...cat.subcategories, sub].sort((a, b) => a.localeCompare(b))
    await db.categories.update(cat.id!, { subcategories: cat.subcategories })
  }
  return cat
}

/** Rename a category everywhere it is referenced. */
export async function renameCategory(db: ExpenseDb, from: string, to: string): Promise<void> {
  const target = to.trim()
  if (!target || target === from) return
  await db.transaction('rw', [db.categories, db.transactions, db.rules, db.budgets], async () => {
    const cat = await db.categories.where('name').equals(from).first()
    if (!cat) return
    await db.categories.update(cat.id!, { name: target })
    await db.transactions.where('category').equals(from).modify({ category: target })
    await db.rules.where('category').equals(from).modify({ category: target })
    await db.budgets.filter((b) => b.category === from).modify({ category: target })
  })
}

export async function renameSubcategory(db: ExpenseDb, category: string, from: string, to: string): Promise<void> {
  const target = to.trim()
  if (!target || target === from) return
  await db.transaction('rw', [db.categories, db.transactions, db.rules, db.budgets], async () => {
    const cat = await db.categories.where('name').equals(category).first()
    if (!cat) return
    const subs = Array.from(new Set(cat.subcategories.map((s) => (s === from ? target : s)))).sort((a, b) => a.localeCompare(b))
    await db.categories.update(cat.id!, { subcategories: subs })
    await db.transactions.where('[category+subcategory]').equals([category, from]).modify({ subcategory: target })
    await db.rules.filter((r) => r.category === category && r.subcategory === from).modify({ subcategory: target })
    await db.budgets.filter((b) => b.category === category && b.subcategory === from).modify({ subcategory: target })
  })
}

/** Delete a category; its transactions become uncategorised and its rules and budgets are removed. */
export async function deleteCategory(db: ExpenseDb, name: string): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.rules, db.budgets], async () => {
    await db.categories.where('name').equals(name).delete()
    await db.transactions.where('category').equals(name).modify({ category: null, subcategory: null, source: null, ruleId: undefined })
    await db.rules.where('category').equals(name).delete()
    await db.budgets.filter((b) => b.category === name).delete()
  })
}
