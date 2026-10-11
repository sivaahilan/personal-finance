import { describe, expect, it } from 'vitest'
import { fingerprintRows } from './fingerprint.ts'

describe('fingerprintRows', () => {
  it('is stable across imports and distinguishes repeated identical rows', () => {
    const rows = [
      { date: '2023-06-01', amount: -9.42, description: 'TRANSPORTFORNSW TAP SYDNEY' },
      { date: '2023-06-01', amount: -9.42, description: 'TRANSPORTFORNSW TAP SYDNEY' },
      { date: '2023-06-01', amount: -9.42, description: 'TRANSPORTFORNSW TAP  SYDNEY' },
    ]
    const a = fingerprintRows(rows)
    const b = fingerprintRows(rows)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(3)
    expect(fingerprintRows(rows.slice(0, 1))[0]).toBe(a[0])
  })
  it('uses balance when present', () => {
    const [x] = fingerprintRows([{ date: '2023-06-01', amount: -5, description: 'A', balance: 100 }])
    const [y] = fingerprintRows([{ date: '2023-06-01', amount: -5, description: 'A', balance: 95 }])
    expect(x).not.toBe(y)
  })
})
