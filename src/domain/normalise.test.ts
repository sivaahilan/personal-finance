import { describe, expect, it } from 'vitest'
import { derivePattern, stripVariableParts, tokens } from './normalise.ts'

describe('derivePattern', () => {
  it('drops card suffixes and value dates', () => {
    expect(derivePattern('WOOLWORTHS 1160 GORDON AU AUS Card xx1517 Value Date: 23/10/2023')).toBe('WOOLWORTHS GORDON')
    expect(derivePattern('KMART 1368 NORTH RYDE AU AUS Card xx1517 Value Date: 29/03/2023')).toBe('KMART NORTH RYDE')
  })
  it('drops reference numbers and booking codes', () => {
    expect(derivePattern('Direct Debit 342190 LAC 534116495')).toBe('Direct Debit LAC')
    expect(derivePattern('AIRBNB * HMJWHM2MXH Surry Hills AUS')).toBe('AIRBNB Surry Hills')
    expect(derivePattern('Transfer to xx7446 CommBank app NDIS')).toBe('Transfer to CommBank app NDIS')
    expect(derivePattern('AIRBNB * HMY4F4DQTZ Surry Hills AUS')).toBe('AIRBNB Surry Hills')
    expect(derivePattern('JETSTAR ANK38FM COLLINGWOOD VIC')).toBe('JETSTAR COLLINGWOOD')
    expect(derivePattern('Direct Credit 074806 BUPA-CLM-CR-0704 C72589211 09954589')).toBe('Direct Credit BUPA-CLM-CR-0704')
  })
  it('keeps merchant names that happen to start with a digit', () => {
    expect(derivePattern('0SCHOOLSONLINE 0000 PARRAMATTA')).toBe('0SCHOOLSONLINE PARRAMATTA')
  })
  it('drops foreign currency amounts and cash-out amounts', () => {
    expect(stripVariableParts('RH *shopwatit.com Dublin GBR ##0523 69.60 US DOLLAR')).toBe('RH shopwatit.com Dublin GBR')
    expect(derivePattern('WOOLWORTHS 1160 GORDON NSW AU Cash Out $150.00')).toBe('WOOLWORTHS GORDON NSW AU Cash Out')
  })
  it('keeps short store numbers that are part of the name', () => {
    expect(derivePattern('PSA*PLUS FITNESS 24 7 LINDFIELD NS')).toBe('PSA PLUS FITNESS 24 7 LINDFIELD')
    expect(derivePattern('7-ELEVEN 2243 LINDFIELD NSW')).toBe('7-ELEVEN LINDFIELD')
  })
  it('does not strip everything from short descriptions', () => {
    expect(derivePattern('AMAZON AU RETAIL SYDNEY')).toBe('AMAZON AU RETAIL SYDNEY')
    expect(derivePattern('INTNL TRANSACTION FEE')).toBe('INTNL TRANSACTION FEE')
  })
})

describe('tokens', () => {
  it('lower-cases and splits on whitespace', () => {
    expect(tokens('Direct Debit  342190 LAC')).toEqual(['direct', 'debit', '342190', 'lac'])
  })
})
