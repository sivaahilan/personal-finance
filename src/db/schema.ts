import Dexie, { type EntityTable } from 'dexie'
import type { Budget, Category, ImportBatch, Rule, Transaction } from '../domain/types.ts'
import { DEFAULT_CATEGORIES } from './seed.ts'

export class ExpenseDb extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  rules!: EntityTable<Rule, 'id'>
  categories!: EntityTable<Category, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  imports!: EntityTable<ImportBatch, 'id'>

  constructor(name = 'expense-tracker') {
    super(name)
    this.version(1).stores({
      transactions: '++id, date, month, &fingerprint, category, [category+subcategory], source, importId',
      rules: '++id, priority, category, enabled',
      categories: '++id, &name, sortOrder',
      budgets: '++id, month, [category+subcategory+month]',
      imports: '++id, importedAt',
    })
    this.on('populate', () => {
      void this.categories.bulkAdd(DEFAULT_CATEGORIES as Category[])
    })
  }
}

export const db = new ExpenseDb()
