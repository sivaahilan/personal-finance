import Papa from 'papaparse'
import { parseDate } from './dates.ts'
import { parseAmount } from './money.ts'

export interface ColumnMapping {
  date: number
  description: number
  amount?: number
  debit?: number
  credit?: number
  balance?: number
  category?: number
  subcategory?: number
}

export interface ParsedRow {
  date: string
  amount: number
  description: string
  balance?: number
  category?: string
  subcategory?: string
}

export interface ParseResult {
  hasHeader: boolean
  headers: string[]
  mapping: ColumnMapping
  rows: ParsedRow[]
  /** Raw rows that could not be parsed, with the reason. */
  skipped: { line: number; reason: string; raw: string[] }[]
  format: string
}

function isDateCell(v: string): boolean {
  return parseDate(v) !== null
}

function isAmountCell(v: string): boolean {
  return parseAmount(v) !== null
}

function headerIndex(headers: string[], patterns: RegExp[]): number | undefined {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h))
    if (i >= 0) return i
  }
  return undefined
}

export function detectHeaderMapping(headers: string[]): ColumnMapping | null {
  const h = headers.map((x) => x.trim().toLowerCase())
  const date = headerIndex(h, [/^(transaction |posted |value )?date$/, /date/])
  const description = headerIndex(h, [/^description$/, /narrative/, /description/, /details/, /^memo$/, /^item$/, /transaction/, /payee/])
  const amount = headerIndex(h, [/^amount$/, /amount/, /^value$/])
  const debit = headerIndex(h, [/debit/, /withdrawal/, /money out/])
  const credit = headerIndex(h, [/credit/, /deposit/, /money in/])
  const balance = headerIndex(h, [/balance/])
  const category = headerIndex(h, [/^category$/])
  const subcategory = headerIndex(h, [/^sub ?category$/])
  if (date === undefined || description === undefined) return null
  if (amount === undefined && (debit === undefined || credit === undefined)) return null
  return { date, description, amount, debit, credit, balance, category, subcategory }
}

/**
 * Work out which column is which for a headerless export (CommBank's format
 * is Date, Amount, Description, Balance with no header row).
 */
export function detectPositionalMapping(rows: string[][]): ColumnMapping | null {
  const sample = rows.slice(0, 20).filter((r) => r.length >= 3)
  if (sample.length === 0) return null
  const width = Math.max(...sample.map((r) => r.length))
  const score = (fn: (v: string) => boolean) =>
    Array.from({ length: width }, (_, i) => sample.filter((r) => r[i] !== undefined && fn(r[i])).length / sample.length)
  const dateScores = score(isDateCell)
  const amountScores = score(isAmountCell)
  const textScores = score((v) => !isDateCell(v) && !isAmountCell(v) && v.trim().length > 0)

  const best = (scores: number[], taken: Set<number>) => {
    let bi = -1
    let bs = 0
    scores.forEach((s, i) => {
      if (!taken.has(i) && s > bs) {
        bs = s
        bi = i
      }
    })
    return bs >= 0.8 ? bi : -1
  }
  const taken = new Set<number>()
  const date = best(dateScores, taken)
  if (date < 0) return null
  taken.add(date)
  const description = best(textScores, taken)
  if (description < 0) return null
  taken.add(description)
  const amount = best(amountScores, taken)
  if (amount < 0) return null
  taken.add(amount)
  const balance = best(amountScores, taken)
  return { date, description, amount, balance: balance >= 0 ? balance : undefined }
}

function looksLikeHeader(row: string[]): boolean {
  return row.length >= 2 && !row.some(isDateCell) && !row.some(isAmountCell)
}

export function parseBankCsv(text: string, override?: { mapping?: ColumnMapping; hasHeader?: boolean }): ParseResult {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  const all = parsed.data.map((r) => r.map((c) => (c ?? '').toString()))
  if (all.length === 0) {
    return { hasHeader: false, headers: [], mapping: { date: 0, description: 2, amount: 1 }, rows: [], skipped: [], format: 'empty' }
  }
  const hasHeader = override?.hasHeader ?? looksLikeHeader(all[0])
  const headers = hasHeader ? all[0] : all[0].map((_, i) => `Column ${i + 1}`)
  const body = hasHeader ? all.slice(1) : all
  let mapping = override?.mapping
  let format = 'custom'
  if (!mapping) {
    if (hasHeader) {
      mapping = detectHeaderMapping(headers) ?? undefined
      format = 'headered'
    } else {
      mapping = detectPositionalMapping(body) ?? undefined
      format = mapping && mapping.date === 0 && mapping.amount === 1 && mapping.description === 2 ? 'commbank' : 'positional'
    }
  }
  if (!mapping) {
    return { hasHeader, headers, mapping: { date: 0, description: 2, amount: 1 }, rows: [], skipped: body.map((raw, i) => ({ line: i + 1, reason: 'Could not detect columns', raw })), format: 'unknown' }
  }
  const rows: ParsedRow[] = []
  const skipped: ParseResult['skipped'] = []
  body.forEach((raw, i) => {
    const line = i + (hasHeader ? 2 : 1)
    const date = parseDate(raw[mapping.date] ?? '')
    if (!date) {
      skipped.push({ line, reason: 'Unrecognised date', raw })
      return
    }
    let amount: number | null = null
    if (mapping.amount !== undefined) {
      amount = parseAmount(raw[mapping.amount] ?? '')
    } else if (mapping.debit !== undefined && mapping.credit !== undefined) {
      const d = parseAmount(raw[mapping.debit] ?? '') ?? 0
      const c = parseAmount(raw[mapping.credit] ?? '') ?? 0
      amount = c - Math.abs(d)
    }
    if (amount === null) {
      skipped.push({ line, reason: 'Unrecognised amount', raw })
      return
    }
    const description = (raw[mapping.description] ?? '').trim()
    if (!description) {
      skipped.push({ line, reason: 'Empty description', raw })
      return
    }
    const balance = mapping.balance !== undefined ? parseAmount(raw[mapping.balance] ?? '') ?? undefined : undefined
    const category = mapping.category !== undefined ? (raw[mapping.category] ?? '').trim() || undefined : undefined
    const subcategory = mapping.subcategory !== undefined ? (raw[mapping.subcategory] ?? '').trim() || undefined : undefined
    rows.push({ date, amount, description, balance, category, subcategory })
  })
  return { hasHeader, headers, mapping, rows, skipped, format }
}
