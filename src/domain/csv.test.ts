import { describe, expect, it } from 'vitest'
import { parseBankCsv } from './csv.ts'

const COMMBANK = `01/02/2023,"-2300.00","Transfer to other Bank NetBank Splurge fund","+12345.67"
03/02/2023,"-800.00","Transfer to other Bank NetBank Holiday fund","+11545.67"
12/02/2023,"-150.00","WOOLWORTHS 1160 GORDON NSW AU Cash Out $150.00","+11395.67"
14/02/2023,"+5826.74","Salary BDO Group Holdin 1002402","+17222.41"
`

describe('parseBankCsv', () => {
  it('detects the headerless CommBank layout', () => {
    const r = parseBankCsv(COMMBANK)
    expect(r.format).toBe('commbank')
    expect(r.hasHeader).toBe(false)
    expect(r.rows).toHaveLength(4)
    expect(r.rows[0]).toMatchObject({ date: '2023-02-01', amount: -2300, description: 'Transfer to other Bank NetBank Splurge fund', balance: 12345.67 })
    expect(r.rows[3].amount).toBe(5826.74)
    expect(r.skipped).toHaveLength(0)
  })

  it('maps headered exports by column name', () => {
    const text = `Date,Description,Debit,Credit,Balance
01/03/2024,COLES EXPRESS 1637 NORTH RYDE,65.01,,1000.00
02/03/2024,Salary,,5000.00,6000.00
`
    const r = parseBankCsv(text)
    expect(r.hasHeader).toBe(true)
    expect(r.rows[0].amount).toBe(-65.01)
    expect(r.rows[1].amount).toBe(5000)
  })

  it('keeps categories from a spreadsheet export', () => {
    const text = `Date,Amount,Item,Category,Subcategory
17/05/2023,-$605.00,Transfer To AC Accounting Busi NetBank 2022 Tax Return,Transfer,Tax Return
`
    const r = parseBankCsv(text)
    expect(r.rows[0]).toMatchObject({ amount: -605, category: 'Transfer', subcategory: 'Tax Return' })
  })

  it('reports rows it cannot parse', () => {
    const r = parseBankCsv(COMMBANK + 'not a date,abc,Something,0\n')
    expect(r.rows).toHaveLength(4)
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0].reason).toMatch(/date/i)
  })

  it('handles a byte-order mark and blank lines', () => {
    const r = parseBankCsv('﻿' + COMMBANK + '\n\n')
    expect(r.rows).toHaveLength(4)
  })
})
