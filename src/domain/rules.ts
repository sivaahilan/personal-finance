import type { Rule, Transaction } from './types.ts'
import { normaliseDescription, tokens } from './normalise.ts'

export function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

/** Does this rule match the transaction? Amount bounds are checked too. */
export function ruleMatches(rule: Rule, tx: Pick<Transaction, 'normalised' | 'amount' | 'description'>): boolean {
  if (!rule.enabled) return false
  if (rule.amountMin !== undefined && tx.amount < rule.amountMin) return false
  if (rule.amountMax !== undefined && tx.amount > rule.amountMax) return false
  const pattern = normaliseDescription(rule.pattern)
  if (!pattern) return false
  const text = tx.normalised || normaliseDescription(tx.description)
  switch (rule.matchType) {
    case 'contains':
      return text.includes(pattern)
    case 'startsWith':
      return text.startsWith(pattern)
    case 'exact':
      return text === pattern
    case 'regex': {
      const re = compileRegex(rule.pattern)
      return re ? re.test(tx.description) : false
    }
    case 'keywords': {
      const want = tokens(pattern)
      if (want.length === 0) return false
      const have = new Set(tokens(text))
      return want.every((w) => have.has(w))
    }
  }
}

/** Specificity used to break priority ties: longer patterns win. */
function specificity(rule: Rule): number {
  return rule.matchType === 'keywords' ? tokens(rule.pattern).length * 10 + rule.pattern.length / 100 : rule.pattern.length
}

/** Sort rules into evaluation order: priority ascending, then most specific first. */
export function orderRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => a.priority - b.priority || specificity(b) - specificity(a) || (a.id ?? 0) - (b.id ?? 0))
}

/** Find the first matching rule from an already-ordered list. */
export function findMatchingRule(ordered: Rule[], tx: Pick<Transaction, 'normalised' | 'amount' | 'description'>): Rule | null {
  for (const r of ordered) if (ruleMatches(r, tx)) return r
  return null
}
