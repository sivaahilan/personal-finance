const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 })
const fmtWhole = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export function money(amount: number, opts: { whole?: boolean } = {}): string {
  const f = opts.whole ? fmtWhole : fmt
  return f.format(Math.round(amount * 100) / 100)
}

/** Parse an amount cell from a bank export. Returns null when not numeric. */
export function parseAmount(input: string): number | null {
  let s = input.trim()
  if (s === '') return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (/\bDR$/i.test(s)) {
    negative = true
    s = s.replace(/\s*DR$/i, '')
  } else if (/\bCR$/i.test(s)) {
    s = s.replace(/\s*CR$/i, '')
  }
  s = s.replace(/[$,\s]/g, '').replace(/^\+/, '')
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return negative ? -n : n
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
