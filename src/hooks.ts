import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from './db/schema.ts'
import type { Category } from './domain/types.ts'

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [], [] as Category[])
}

export function useRules() {
  return useLiveQuery(() => db.rules.orderBy('priority').toArray(), [], [])
}

export function useBudgets() {
  return useLiveQuery(() => db.budgets.toArray(), [], [])
}

export function useAllTransactions() {
  return useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [], [])
}

export function useMonthTransactions(month: string) {
  return useLiveQuery(() => db.transactions.where('month').equals(month).toArray(), [month], [])
}

export function useAvailableMonths(): string[] {
  const months = useLiveQuery(() => db.transactions.orderBy('month').uniqueKeys(), [], [] as unknown[])
  return useMemo(() => (months as string[]).slice().reverse(), [months])
}

const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)']

/** Fixed colour per category, assigned by category order so it never changes when filters change. */
export function useCategoryColours(categories: Category[]): (name: string | null | undefined) => string {
  return useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((c, i) => map.set(c.name, i < SERIES.length ? SERIES[i] : 'var(--other)'))
    return (name) => (name ? map.get(name) ?? 'var(--other)' : 'var(--other)')
  }, [categories])
}
