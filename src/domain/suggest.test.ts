import { describe, expect, it } from 'vitest'
import { buildIndex, suggestFor } from './suggest.ts'
import { DEFAULT_CATEGORIES } from '../db/seed.ts'
import type { Category } from './types.ts'

const categories = DEFAULT_CATEGORIES as Category[]

describe('suggestFor', () => {
  it('suggests from similar transactions the user already categorised', () => {
    const index = buildIndex({
      categories,
      rules: [],
      history: [
        { description: 'PYMBLE PHARMACY PTY LT PYMBLE', category: 'Health', subcategory: 'Pharmacy', amount: -25 },
        { description: 'PYMBLE PHARMACY PTY LT PYMBLE', category: 'Health', subcategory: 'Pharmacy', amount: -30 },
      ],
    })
    const s = suggestFor({ description: 'PYMBLE PHARMACY PTY LT PYMBLE NSW', amount: -12 }, index)
    expect(s[0]).toMatchObject({ category: 'Health', subcategory: 'Pharmacy' })
    expect(s[0].confidence).toBeGreaterThan(0.8)
  })

  it('falls back to merchant hints when there is no history', () => {
    const index = buildIndex({ categories, rules: [], history: [] })
    const s = suggestFor({ description: 'AMPOL BELROSE BELROSE', amount: -60 }, index)
    expect(s[0]).toMatchObject({ category: 'Transport', subcategory: 'Fuel' })
    const t = suggestFor({ description: 'INTNL TRANSACTION FEE', amount: -0.3 }, index)
    expect(t[0]).toMatchObject({ category: 'Miscellaneous', subcategory: 'Bank Fees' })
  })

  it('uses nearby rules', () => {
    const index = buildIndex({
      categories,
      rules: [{ pattern: 'Transfer To Krishan Ahillen CommBank App Chores', matchType: 'keywords', category: 'Kids', subcategory: 'Pocket Money', priority: 100, enabled: true, createdAt: '' }],
      history: [],
    })
    const s = suggestFor({ description: 'Transfer To Krishan Ahillen CommBank App Pocket money', amount: -30 }, index)
    expect(s.some((x) => x.category === 'Kids' && x.subcategory === 'Pocket Money')).toBe(true)
  })

  it('only suggests categories that exist', () => {
    const index = buildIndex({ categories: categories.filter((c) => c.name !== 'Transport'), rules: [], history: [] })
    const s = suggestFor({ description: 'AMPOL BELROSE', amount: -60 }, index)
    expect(s.every((x) => x.category !== 'Transport')).toBe(true)
  })
})
