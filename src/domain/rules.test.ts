import { describe, expect, it } from 'vitest'
import { findMatchingRule, orderRules, ruleMatches } from './rules.ts'
import type { Rule } from './types.ts'
import { normaliseDescription } from './normalise.ts'

function rule(over: Partial<Rule>): Rule {
  return { pattern: '', matchType: 'keywords', category: 'X', subcategory: '', priority: 100, enabled: true, createdAt: '', ...over }
}
function tx(description: string, amount = -10) {
  return { description, normalised: normaliseDescription(description), amount }
}

describe('ruleMatches', () => {
  it('keywords match in any order, whole tokens only', () => {
    const r = rule({ pattern: 'Direct Debit LAC' })
    expect(ruleMatches(r, tx('Direct Debit 342190 LAC 534116495'))).toBe(true)
    expect(ruleMatches(r, tx('Direct Debit 342190 BLACK 534116495'))).toBe(false)
  })
  it('contains / startsWith / exact are case-insensitive', () => {
    expect(ruleMatches(rule({ pattern: 'woolworths', matchType: 'contains' }), tx('WOOLWORTHS 1160 GORDON'))).toBe(true)
    expect(ruleMatches(rule({ pattern: 'Loan Repayment LN REPAY 873294693', matchType: 'contains' }), tx('Loan Repayment LN REPAY 466467251'))).toBe(false)
    expect(ruleMatches(rule({ pattern: 'salary', matchType: 'startsWith' }), tx('Salary BDO Group'))).toBe(true)
    expect(ruleMatches(rule({ pattern: 'salary', matchType: 'startsWith' }), tx('My Salary'))).toBe(false)
    expect(ruleMatches(rule({ pattern: 'intnl transaction fee', matchType: 'exact' }), tx('INTNL TRANSACTION FEE'))).toBe(true)
  })
  it('regex rules work and bad regexes never match', () => {
    expect(ruleMatches(rule({ pattern: '^transfer to xx\\d{4}', matchType: 'regex' }), tx('Transfer to xx7446 CommBank app NDIS'))).toBe(true)
    expect(ruleMatches(rule({ pattern: '[', matchType: 'regex' }), tx('anything'))).toBe(false)
  })
  it('respects amount bounds and the enabled flag', () => {
    const r = rule({ pattern: 'transfer', amountMin: -1000, amountMax: -500 })
    expect(ruleMatches(r, tx('Transfer to other Bank', -800))).toBe(true)
    expect(ruleMatches(r, tx('Transfer to other Bank', -2300))).toBe(false)
    expect(ruleMatches(rule({ pattern: 'transfer', enabled: false }), tx('Transfer'))).toBe(false)
  })
})

describe('orderRules', () => {
  it('runs lower priority numbers first, then more specific patterns', () => {
    const generic = rule({ id: 1, pattern: 'woolworths', category: 'Groceries' })
    const specific = rule({ id: 2, pattern: 'woolworths cash out', category: 'Cash' })
    const urgent = rule({ id: 3, pattern: 'woolworths', category: 'Urgent', priority: 1 })
    const ordered = orderRules([generic, specific, urgent])
    expect(ordered.map((r) => r.id)).toEqual([3, 2, 1])
    expect(findMatchingRule(orderRules([generic, specific]), tx('WOOLWORTHS 1160 GORDON NSW AU Cash Out $150.00'))?.category).toBe('Cash')
    expect(findMatchingRule(orderRules([generic, specific]), tx('WOOLWORTHS 1160 GORDON'))?.category).toBe('Groceries')
  })
})
