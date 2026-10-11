/** Collapse whitespace and trim. */
export function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Normalised form used for matching: lower-case, single spaces. */
export function normaliseDescription(description: string): string {
  return collapse(description).toLowerCase()
}

const STATE_TOKENS = new Set(['aus', 'au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'act', 'tas', 'nt', 'ns', 'vi', 'ql'])

/**
 * Strip the parts of a bank description that change between transactions:
 * card suffixes, value dates, reference numbers, foreign currency amounts.
 * The result is the "merchant" part, suitable for a keywords rule.
 */
export function stripVariableParts(description: string): string {
  let s = collapse(description)
  s = s.replace(/\bcard\s+xx\d+.*$/i, ' ')
  s = s.replace(/\bvalue date:?\s*\d{1,2}\/\d{1,2}\/\d{2,4}/gi, ' ')
  s = s.replace(/\d+(?:,\d{3})*\.\d{2}\s+[A-Z][A-Z ]+(?:DOLLAR|RUPEE|EURO|POUND|YEN|BAHT|DIRHAM)S?/gi, ' ')
  s = s.replace(/\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g, ' ')
  s = s.replace(/\bxx\d{2,}\b/gi, ' ')
  s = s.replace(/##?\d{2,}\b/g, ' ')
  s = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
  // Runs of 4+ digits (store numbers, invoice numbers, account references).
  s = s.replace(/(?<!\S)\d{4,}(?!\S)/g, ' ')
  // Mixed letter/digit codes (booking references): 6+ chars with two or more
  // digits, or one digit and no vowels. "0SCHOOLSONLINE" survives, "HMJWHM2MXH" does not.
  s = s.replace(/(?<!\S)[A-Z0-9]{6,}(?!\S)/g, (tok) => {
    const digits = (tok.match(/\d/g) ?? []).length
    const letters = tok.length - digits
    if (digits === 0 || letters === 0) return tok
    return digits >= 2 || !/[AEIOU]/.test(tok) ? ' ' : tok
  })
  s = s.replace(/[*]+/g, ' ')
  return collapse(s)
}

/** Tokens of a string for keyword matching (lower-case words, punctuation-light). */
export function tokens(s: string): string[] {
  return normaliseDescription(s)
    .split(/[\s,;:()]+/)
    .map((t) => t.replace(/^[^a-z0-9&'.#*-]+|[^a-z0-9&'.#*-]+$/g, ''))
    .filter((t) => t.length > 0)
}

/**
 * Derive a rule pattern from a transaction description. Variable parts are
 * stripped and trailing state/country tokens dropped so the pattern is stable
 * across visits to the same merchant.
 */
export function derivePattern(description: string): string {
  const cleaned = stripVariableParts(description)
  const parts = cleaned.split(' ')
  while (parts.length > 2 && STATE_TOKENS.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop()
  }
  return parts.join(' ')
}

/** Small stable hash for fingerprints (FNV-1a, 32-bit, hex). */
export function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
