import { useId } from 'react'
import type { Category } from '../domain/types.ts'

export interface CategoryValue {
  category: string
  subcategory: string
}

/**
 * Category select plus a free-text subcategory with suggestions, so a new
 * subcategory can be typed straight in.
 */
export function CategoryPicker({ categories, value, onChange, allowNew = true, autoFocus }: { categories: Category[]; value: CategoryValue; onChange: (v: CategoryValue) => void; allowNew?: boolean; autoFocus?: boolean }) {
  const listId = useId()
  const current = categories.find((c) => c.name === value.category)
  return (
    <div className="row">
      <select
        autoFocus={autoFocus}
        aria-label="Category"
        value={current ? value.category : value.category ? '__new__' : ''}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            const name = window.prompt('New category name')?.trim()
            if (name) onChange({ category: name, subcategory: '' })
            return
          }
          onChange({ category: e.target.value, subcategory: '' })
        }}
      >
        <option value="">Choose category…</option>
        {categories.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
        {allowNew && <option value="__new__">+ New category…</option>}
      </select>
      <input
        list={listId}
        aria-label="Subcategory"
        placeholder="Subcategory (optional)"
        value={value.subcategory}
        disabled={!value.category}
        onChange={(e) => onChange({ ...value, subcategory: e.target.value })}
        style={{ width: 190 }}
      />
      <datalist id={listId}>
        {(current?.subcategories ?? []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
