const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Parse a date string from a bank export into ISO YYYY-MM-DD.
 * Australian day-first order is assumed for slash/dash dates.
 */
export function parseDate(input: string): string | null {
  const s = input.trim()
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    const d = Number(m[1])
    const mo = Number(m[2])
    let y = Number(m[3])
    if (m[3].length === 2) y += y < 70 ? 2000 : 1900
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/))) {
    const d = Number(m[1])
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    let y = Number(m[3])
    if (m[3].length === 2) y += 2000
    if (!mo) return null
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null
  }
  return null
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${pad(nm)}`
}

export function monthLabel(month: string, style: 'short' | 'long' = 'long'): string {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, 1))
  return dt.toLocaleDateString('en-AU', { month: style, year: 'numeric', timeZone: 'UTC' })
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

/** Inclusive list of months from a to b (both YYYY-MM). */
export function monthRange(a: string, b: string): string[] {
  const out: string[] = []
  let cur = a
  while (cur <= b) {
    out.push(cur)
    cur = addMonths(cur, 1)
  }
  return out
}
