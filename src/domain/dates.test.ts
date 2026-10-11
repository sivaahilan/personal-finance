import { describe, expect, it } from 'vitest'
import { addMonths, monthRange, parseDate } from './dates.ts'

describe('parseDate', () => {
  it('parses Australian day-first dates', () => {
    expect(parseDate('23/10/2023')).toBe('2023-10-23')
    expect(parseDate('1/2/2024')).toBe('2024-02-01')
    expect(parseDate('01-02-24')).toBe('2024-02-01')
  })
  it('parses ISO and month-name dates', () => {
    expect(parseDate('2024-02-01')).toBe('2024-02-01')
    expect(parseDate('1 Feb 2024')).toBe('2024-02-01')
  })
  it('rejects non-dates', () => {
    expect(parseDate('Woolworths')).toBeNull()
    expect(parseDate('31/02/2024')).toBeNull()
    expect(parseDate('-300.00')).toBeNull()
  })
})

describe('months', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2023-12', 1)).toBe('2024-01')
    expect(addMonths('2024-01', -1)).toBe('2023-12')
  })
  it('builds inclusive ranges', () => {
    expect(monthRange('2023-11', '2024-01')).toEqual(['2023-11', '2023-12', '2024-01'])
  })
})
