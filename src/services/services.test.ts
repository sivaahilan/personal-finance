import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ExpenseDb } from '../db/schema.ts'
import { parseBankCsv } from '../domain/csv.ts'
import { importRows } from './importService.ts'
import { addRuleAndApply, applyRules, previewRule, setCategory } from './categorise.ts'
import { buildBudgetLines, totals } from './budgets.ts'
import { exportBackup, importRules, parseRulesFile, restoreBackup } from './backup.ts'
import { deleteCategory, renameSubcategory } from './categories.ts'

const CSV = `01/06/2023,"-9.42","TRANSPORTFORNSW TAP SYDNEY","+100.00"
01/06/2023,"-9.42","TRANSPORTFORNSW TAP SYDNEY","+90.58"
02/06/2023,"-52.50","UNITED PETROLEUM PTY TERREY HILLSNSW","+38.08"
06/06/2023,"+5826.74","Salary BDO Group Holdin 1002402","+5864.82"
09/06/2023,"-2300.00","Transfer to other Bank NetBank Splurge fund","+3564.82"
`

let db: ExpenseDb
let n = 0
beforeEach(async () => {
  db = new ExpenseDb(`test-${n++}`)
  await db.open()
  await db.rules.add({ pattern: 'TRANSPORTFORNSW TAP', matchType: 'keywords', category: 'Transport', subcategory: 'Train', priority: 100, enabled: true, createdAt: '' })
  await db.rules.add({ pattern: 'Salary BDO', matchType: 'keywords', category: 'Salary', subcategory: '', priority: 100, enabled: true, createdAt: '' })
})

describe('importRows', () => {
  it('imports, categorises by rule and skips duplicates on re-import', async () => {
    const parsed = parseBankCsv(CSV)
    const first = await importRows(db, parsed.rows, 'june.csv')
    expect(first).toMatchObject({ rows: 5, added: 5, duplicates: 0, categorised: 3, uncategorised: 2 })
    const second = await importRows(db, parsed.rows, 'june-again.csv')
    expect(second).toMatchObject({ added: 0, duplicates: 5 })
    expect(await db.transactions.count()).toBe(5)
    const train = await db.transactions.where('category').equals('Transport').toArray()
    expect(train).toHaveLength(2)
    expect(train[0].source).toBe('rule')
  })

  it('keeps categories supplied in the file and creates them', async () => {
    const parsed = parseBankCsv(`Date,Amount,Item,Category,Subcategory\n17/05/2023,-605.00,Tax return,Transfer,Tax Return\n`)
    await importRows(db, parsed.rows, 'sheet.csv')
    const tx = await db.transactions.toArray()
    expect(tx[0]).toMatchObject({ category: 'Transfer', subcategory: 'Tax Return', source: 'import' })
    const cat = await db.categories.where('name').equals('Transfer').first()
    expect(cat?.subcategories).toContain('Tax Return')
  })
})

describe('rules and manual edits', () => {
  it('a new rule applies to uncategorised and rule-set transactions but not manual ones', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    const fuel = (await db.transactions.filter((t) => t.description.includes('UNITED')).first())!
    const splurge = (await db.transactions.filter((t) => t.description.includes('Splurge')).first())!
    await setCategory(db, [splurge.id!], 'Shopping', 'Other')
    const { applied } = await addRuleAndApply(db, { pattern: 'Transfer to other Bank NetBank Splurge fund', matchType: 'keywords', category: 'Splurge', subcategory: 'Splurge', priority: 100, enabled: true })
    expect(applied).toBe(0)
    expect((await db.transactions.get(splurge.id!))!.category).toBe('Shopping')
    const r = await addRuleAndApply(db, { pattern: 'UNITED PETROLEUM', matchType: 'keywords', category: 'Transport', subcategory: 'Fuel', priority: 100, enabled: true })
    expect(r.applied).toBe(1)
    expect((await db.transactions.get(fuel.id!))!).toMatchObject({ category: 'Transport', subcategory: 'Fuel', source: 'rule' })
  })

  it('applyRules with scope all overrides manual assignments, and clears stale rule assignments', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    const splurge = (await db.transactions.filter((t) => t.description.includes('Splurge')).first())!
    await setCategory(db, [splurge.id!], 'Shopping', 'Other')
    await db.rules.add({ pattern: 'Splurge fund', matchType: 'keywords', category: 'Splurge', subcategory: 'Splurge', priority: 100, enabled: true, createdAt: '' })
    await applyRules(db, 'all')
    expect((await db.transactions.get(splurge.id!))!.category).toBe('Splurge')
    await db.rules.where('category').equals('Transport').delete()
    const res = await applyRules(db, 'rules')
    expect(res.cleared).toBe(2)
    expect(await db.transactions.filter((t) => !t.category).count()).toBe(3)
  })

  it('previewRule reports conflicts', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    const all = await db.transactions.toArray()
    const p = previewRule({ pattern: 'TAP', matchType: 'keywords', category: 'Transport', subcategory: 'Bus', priority: 100, enabled: true, createdAt: '' }, all)
    expect(p.hits).toHaveLength(2)
    expect(p.conflicting).toHaveLength(2)
    expect(p.same).toHaveLength(0)
  })
})

describe('budgets', () => {
  it('computes actual vs budget using month-specific then default budgets', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    await db.budgets.bulkAdd([
      { category: 'Transport', subcategory: '', month: 'default', amount: 100 },
      { category: 'Transport', subcategory: '', month: '2023-06', amount: 50 },
      { category: 'Kids', subcategory: 'School Fees', month: 'default', amount: 400 },
    ])
    const lines = buildBudgetLines(await db.categories.toArray(), await db.budgets.toArray(), await db.transactions.toArray(), '2023-06')
    const transport = lines.find((l) => l.category === 'Transport')!
    expect(transport.actual).toBeCloseTo(18.84)
    expect(transport.budget).toBe(50)
    expect(transport.budgetSource).toBe('month')
    const kids = lines.find((l) => l.category === 'Kids')!
    expect(kids.budget).toBe(400)
    expect(kids.budgetSource).toBe('subcategories')
    const salary = lines.find((l) => l.category === 'Salary')!
    expect(salary.actual).toBeCloseTo(5826.74)
    const t = totals(lines)
    expect(t.income).toBeCloseTo(5826.74)
    expect(t.budgeted).toBe(450)
    const july = buildBudgetLines(await db.categories.toArray(), await db.budgets.toArray(), await db.transactions.toArray(), '2023-07')
    expect(july.find((l) => l.category === 'Transport')!.budget).toBe(100)
  })
})

describe('backup and rules import', () => {
  it('round-trips a backup', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    const backup = await exportBackup(db)
    const other = new ExpenseDb(`restore-${n++}`)
    await other.open()
    await restoreBackup(other, backup)
    expect(await other.transactions.count()).toBe(5)
    expect(await other.rules.count()).toBe(2)
  })

  it('imports rules from the simple file format and creates categories', async () => {
    const rows = parseRulesFile([
      { item: 'Loan Repayment LN REPAY 873294693', category: 'Mortgage', subcategory: 'Variable', matchType: 'contains' },
      { pattern: 'TRANSPORTFORNSW TAP', category: 'Transport', subcategory: 'Train' },
      { pattern: 'NEW MERCHANT', category: 'Brand New', subcategory: 'Sub' },
    ])
    const res = await importRules(db, rows)
    expect(res).toEqual({ added: 2, skipped: 1 })
    expect(await db.categories.where('name').equals('Brand New').first()).toMatchObject({ subcategories: ['Sub'] })
    expect(() => parseRulesFile({ nope: true })).toThrow()
  })
})

describe('category maintenance', () => {
  it('renames subcategories and deletes categories consistently', async () => {
    await importRows(db, parseBankCsv(CSV).rows, 'june.csv')
    await renameSubcategory(db, 'Transport', 'Train', 'Public Transport')
    expect((await db.transactions.where('category').equals('Transport').first())!.subcategory).toBe('Public Transport')
    expect((await db.rules.filter((r) => r.category === 'Transport').first())!.subcategory).toBe('Public Transport')
    await deleteCategory(db, 'Transport')
    expect(await db.transactions.where('category').equals('Transport').count()).toBe(0)
    expect(await db.rules.filter((r) => r.category === 'Transport').count()).toBe(0)
    expect(await db.transactions.filter((t) => !t.category).count()).toBe(4)
  })
})
