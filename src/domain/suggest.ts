import type { Category, Rule, Suggestion, Transaction } from './types.ts'
import { KEYWORD_HINTS } from './keywords.ts'
import { derivePattern, normaliseDescription, tokens } from './normalise.ts'

const GENERIC = new Set(['the', 'and', 'of', 'to', 'from', 'pty', 'ltd', 'p/l', 'au', 'aus', 'nsw', 'vic', 'qld', 'wa', 'sa', 'act', 'tas', 'nt', 'sydney', 'melbourne', 'brisbane', 'perth', 'card', 'value', 'date', 'direct', 'debit', 'credit', 'transfer', 'commbank', 'netbank', 'app', 'payment', 'purchase'])

function sig(description: string): Set<string> {
  return new Set(tokens(derivePattern(description)).filter((t) => t.length > 1 && !GENERIC.has(t)))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

export interface SuggestionContext {
  categories: Category[]
  rules: Rule[]
  /** Already-categorised transactions to learn from. */
  history: Pick<Transaction, 'description' | 'category' | 'subcategory' | 'amount'>[]
}

/** Pre-compute history signatures once per review session. */
export function buildIndex(ctx: SuggestionContext) {
  const groups = new Map<string, { category: string; subcategory: string; sigs: Set<string>[]; count: number }>()
  for (const h of ctx.history) {
    if (!h.category) continue
    const key = `${h.category}::${h.subcategory ?? ''}`
    let g = groups.get(key)
    if (!g) {
      g = { category: h.category, subcategory: h.subcategory ?? '', sigs: [], count: 0 }
      groups.set(key, g)
    }
    g.count++
    if (g.sigs.length < 400) g.sigs.push(sig(h.description))
  }
  const ruleSigs = ctx.rules.filter((r) => r.enabled).map((r) => ({ rule: r, sig: sig(r.pattern) }))
  const catNames = new Set(ctx.categories.map((c) => c.name))
  const subs = new Map(ctx.categories.map((c) => [c.name, new Set(c.subcategories)]))
  return { groups, ruleSigs, catNames, subs }
}

export type SuggestIndex = ReturnType<typeof buildIndex>

/**
 * Suggest categories for a transaction that matched no rule. Sources, in
 * order of trust: similar transactions the user already categorised, rules
 * whose keywords mostly overlap, and generic merchant hints.
 */
export function suggestFor(tx: Pick<Transaction, 'description' | 'amount'>, index: SuggestIndex, limit = 3): Suggestion[] {
  const s = sig(tx.description)
  const text = normaliseDescription(tx.description)
  const found = new Map<string, Suggestion>()
  const add = (sug: Suggestion) => {
    const key = `${sug.category}::${sug.subcategory}`
    const existing = found.get(key)
    if (!existing || existing.confidence < sug.confidence) found.set(key, sug)
  }

  for (const g of index.groups.values()) {
    let best = 0
    for (const other of g.sigs) {
      const j = jaccard(s, other)
      if (j > best) best = j
      if (best === 1) break
    }
    if (best >= 0.34) {
      add({ category: g.category, subcategory: g.subcategory, confidence: Math.min(0.98, 0.4 + best * 0.58), reason: best === 1 ? 'Same merchant as transactions you categorised' : 'Similar to transactions you categorised' })
    }
  }

  for (const { rule, sig: rs } of index.ruleSigs) {
    const j = jaccard(s, rs)
    if (j >= 0.5 && j < 1) {
      add({ category: rule.category, subcategory: rule.subcategory, confidence: 0.35 + j * 0.4, reason: `Close to rule "${rule.pattern}"` })
    }
  }

  for (const hint of KEYWORD_HINTS) {
    if (!index.catNames.has(hint.category)) continue
    const hit = hint.phrases.find((p) => {
      const words = p.trim().split(/\s+/)
      return words.every((w) => text.includes(w))
    })
    if (!hit) continue
    const subOk = hint.subcategory === '' || (index.subs.get(hint.category)?.has(hint.subcategory) ?? false)
    const specificity = Math.min(1, hit.replace(/\s/g, '').length / 10)
    add({ category: hint.category, subcategory: subOk ? hint.subcategory : '', confidence: 0.3 + specificity * 0.3, reason: `Looks like "${hit.trim()}"` })
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence).slice(0, limit)
}
