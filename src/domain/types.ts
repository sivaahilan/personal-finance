export type CategoryType = 'expense' | 'income' | 'transfer'

export interface Category {
  id?: number
  name: string
  type: CategoryType
  subcategories: string[]
  sortOrder: number
}

export type MatchType = 'keywords' | 'contains' | 'startsWith' | 'exact' | 'regex'

export interface Rule {
  id?: number
  pattern: string
  matchType: MatchType
  category: string
  subcategory: string
  /** Lower runs first. Default 100. */
  priority: number
  enabled: boolean
  /** Optional amount bounds (signed, negative = outflow). */
  amountMin?: number
  amountMax?: number
  createdAt: string
  notes?: string
}

export type AssignmentSource = 'rule' | 'manual' | 'import'

export interface Transaction {
  id?: number
  /** ISO date YYYY-MM-DD */
  date: string
  /** YYYY-MM, derived from date */
  month: string
  /** Signed: negative = money out, positive = money in */
  amount: number
  description: string
  /** Lower-cased, whitespace-collapsed description used for matching */
  normalised: string
  balance?: number
  /** Unique key used to skip duplicates on re-import */
  fingerprint: string
  category: string | null
  subcategory: string | null
  source: AssignmentSource | null
  ruleId?: number
  importId?: number
  notes?: string
}

export interface Budget {
  id?: number
  category: string
  /** '' means the whole category */
  subcategory: string
  /** 'default' applies to any month without an explicit entry */
  month: string
  amount: number
}

export interface ImportBatch {
  id?: number
  filename: string
  importedAt: string
  rows: number
  added: number
  duplicates: number
  categorised: number
  uncategorised: number
}

export interface Suggestion {
  category: string
  subcategory: string
  confidence: number
  reason: string
}
