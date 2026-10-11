import { hash, normaliseDescription } from './normalise.ts'
import type { ParsedRow } from './csv.ts'

/**
 * Build fingerprints for rows in one file. Identical rows (same date, amount,
 * description and balance) get an occurrence index so that two genuine
 * $9.42 train taps on the same day both import, while re-importing the same
 * file is a no-op.
 */
export function fingerprintRows(rows: ParsedRow[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = `${r.date}|${r.amount.toFixed(2)}|${normaliseDescription(r.description)}|${r.balance === undefined ? '' : r.balance.toFixed(2)}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return hash(`${base}#${n}`) + hash(base.split('').reverse().join(''))
  })
}
