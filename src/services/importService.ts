import type { ExpenseDb } from '../db/schema.ts'
import type { ParsedRow } from '../domain/csv.ts'
import { fingerprintRows } from '../domain/fingerprint.ts'
import { monthOf } from '../domain/dates.ts'
import { normaliseDescription } from '../domain/normalise.ts'
import { findMatchingRule, orderRules } from '../domain/rules.ts'
import type { ImportBatch, Transaction } from '../domain/types.ts'
import { ensureCategory } from './categories.ts'

export interface ImportSummary extends ImportBatch {
  addedIds: number[]
}

/**
 * Write parsed rows into the database: skip rows already present, apply
 * rules to the rest, and record the batch. Rows that carry a category
 * (e.g. a spreadsheet export) keep it as a manual assignment.
 */
export async function importRows(db: ExpenseDb, rows: ParsedRow[], filename: string): Promise<ImportSummary> {
  const fps = fingerprintRows(rows)
  const existing = new Set((await db.transactions.where('fingerprint').anyOf(fps).toArray()).map((t) => t.fingerprint))
  const ordered = orderRules(await db.rules.toArray())

  const batch: ImportBatch = { filename, importedAt: new Date().toISOString(), rows: rows.length, added: 0, duplicates: 0, categorised: 0, uncategorised: 0 }
  const importId = await db.imports.add(batch)

  const toAdd: Transaction[] = []
  const seenInFile = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const fp = fps[i]
    if (existing.has(fp) || seenInFile.has(fp)) {
      batch.duplicates++
      continue
    }
    seenInFile.add(fp)
    const r = rows[i]
    const tx: Transaction = {
      date: r.date,
      month: monthOf(r.date),
      amount: r.amount,
      description: r.description,
      normalised: normaliseDescription(r.description),
      balance: r.balance,
      fingerprint: fp,
      category: null,
      subcategory: null,
      source: null,
      importId,
    }
    if (r.category) {
      await ensureCategory(db, r.category, r.subcategory ?? '')
      tx.category = r.category
      tx.subcategory = r.subcategory ?? ''
      tx.source = 'import'
    } else {
      const rule = findMatchingRule(ordered, tx)
      if (rule) {
        tx.category = rule.category
        tx.subcategory = rule.subcategory
        tx.source = 'rule'
        tx.ruleId = rule.id
      }
    }
    if (tx.category) batch.categorised++
    else batch.uncategorised++
    toAdd.push(tx)
  }
  const addedIds = (await db.transactions.bulkAdd(toAdd, { allKeys: true })) as number[]
  batch.added = toAdd.length
  await db.imports.update(importId, { added: batch.added, duplicates: batch.duplicates, categorised: batch.categorised, uncategorised: batch.uncategorised })
  return { ...batch, id: importId, addedIds }
}
