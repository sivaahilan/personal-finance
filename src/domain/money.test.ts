import { describe, expect, it } from 'vitest'
import { parseAmount } from './money.ts'

describe('parseAmount', () => {
  it('parses CommBank style amounts', () => {
    expect(parseAmount('-300.00')).toBe(-300)
    expect(parseAmount('+5826.74')).toBe(5826.74)
    expect(parseAmount('"-2,300.00"'.replace(/"/g, ''))).toBe(-2300)
    expect(parseAmount('$1,234.56')).toBe(1234.56)
  })
  it('handles accounting conventions', () => {
    expect(parseAmount('(45.00)')).toBe(-45)
    expect(parseAmount('45.00 DR')).toBe(-45)
    expect(parseAmount('45.00 CR')).toBe(45)
  })
  it('rejects text', () => {
    expect(parseAmount('Transfer')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})
