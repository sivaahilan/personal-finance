import { useMemo, useState } from 'react'
import { db } from '../db/schema.ts'
import { currentMonth, monthLabel } from '../domain/dates.ts'
import { money } from '../domain/money.ts'
import { buildBudgetLines, totals, type BudgetLine } from '../services/budgets.ts'
import { useAvailableMonths, useBudgets, useCategories, useCategoryColours, useMonthTransactions } from '../hooks.ts'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { BudgetBar } from '../components/charts/BudgetBar.tsx'
import { useToast } from '../components/Toast.tsx'

export default function Budgets() {
  const months = useAvailableMonths()
  const [month, setMonth] = useState(() => currentMonth())
  const categories = useCategories()
  const budgets = useBudgets()
  const txs = useMonthTransactions(month)
  const colour = useCategoryColours(categories)
  const toast = useToast()
  const [showSubs, setShowSubs] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const lines = useMemo(() => {
    const built = buildBudgetLines(categories, budgets, txs, month)
    // Show every expense category so a budget can be entered even with no spend yet.
    const have = new Set(built.map((l) => l.category))
    const extra: BudgetLine[] = categories.filter((c) => c.type === 'expense' && !have.has(c.name)).map((c) => ({ category: c.name, type: c.type, actual: 0, budget: null, budgetSource: null, subs: c.subcategories.map((s) => ({ subcategory: s, actual: 0, budget: null })) }))
    const order = new Map(categories.map((c, i) => [c.name, i]))
    return [...built, ...extra].filter((l) => l.type === 'expense').sort((a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999))
  }, [categories, budgets, txs, month])
  const t = totals(lines)

  function value(category: string, subcategory: string, m: string): number | '' {
    return budgets.find((b) => b.category === category && b.subcategory === subcategory && b.month === m)?.amount ?? ''
  }
  async function save(category: string, subcategory: string, m: string, raw: string) {
    const existing = await db.budgets.where('[category+subcategory+month]').equals([category, subcategory, m]).first()
    const amount = raw.trim() === '' ? null : Number(raw)
    if (amount === null || Number.isNaN(amount)) {
      if (existing) await db.budgets.delete(existing.id!)
      return
    }
    if (existing) await db.budgets.update(existing.id!, { amount })
    else await db.budgets.add({ category, subcategory, month: m, amount })
  }
  async function copyFrom(source: string) {
    const src = budgets.filter((b) => b.month === source)
    if (src.length === 0) {
      toast(`No budgets set for ${monthLabel(source)}`)
      return
    }
    for (const b of src) await save(b.category, b.subcategory, month, String(b.amount))
    toast(`Copied ${src.length} budget${src.length === 1 ? '' : 's'} from ${monthLabel(source)}`)
  }
  async function makeDefault() {
    const src = budgets.filter((b) => b.month === month)
    if (src.length === 0) {
      toast('Nothing set for this month yet')
      return
    }
    for (const b of src) await save(b.category, b.subcategory, 'default', String(b.amount))
    toast(`Saved ${src.length} amount${src.length === 1 ? '' : 's'} as the default for every month`)
  }

  const Input = ({ category, subcategory, m, placeholder }: { category: string; subcategory: string; m: string; placeholder?: string }) => (
    <input
      type="number"
      step="1"
      min="0"
      aria-label={`${category}${subcategory ? ' ' + subcategory : ''} budget ${m === 'default' ? 'default' : 'this month'}`}
      placeholder={placeholder}
      defaultValue={value(category, subcategory, m)}
      key={`${category}|${subcategory}|${m}|${value(category, subcategory, m)}`}
      onBlur={(e) => void save(category, subcategory, m, e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      style={{ width: 96 }}
    />
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <div className="sub">Set a default amount per category; override any month that is different. Spend is compared against whichever applies.</div>
        </div>
        <MonthPicker month={month} onChange={setMonth} months={months} />
      </div>

      <div className="grid tiles">
        <div className="tile"><div className="label">Budgeted</div><div className="value">{money(t.budgeted, { whole: true })}</div></div>
        <div className="tile"><div className="label">Spent</div><div className="value">{money(t.spent, { whole: true })}</div></div>
        <div className="tile"><div className="label">Remaining</div><div className={`value ${t.budgeted - t.spent < 0 ? 'over' : ''}`}>{money(t.budgeted - t.spent, { whole: true })}</div></div>
        <div className="tile"><div className="label">Over budget</div><div className="value">{lines.filter((l) => l.budget !== null && l.actual > l.budget).length}</div><div className="delta">categories</div></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{monthLabel(month)}</h2>
          <div className="row">
            <label className="check small"><input type="checkbox" checked={showSubs} onChange={(e) => setShowSubs(e.target.checked)} /> Show subcategories</label>
            <button className="small" onClick={() => copyFrom(months.find((m) => m < month) ?? month)}>Copy previous month</button>
            <button className="small" onClick={makeDefault} title="Use this month's amounts as the default for all months">Make this the default</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Category</th><th style={{ minWidth: 160 }}>Progress</th><th className="num">Spent</th><th className="num">This month</th><th className="num">Default</th><th className="num">Remaining</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const isOpen = showSubs || open.has(l.category)
                const remaining = l.budget === null ? null : l.budget - l.actual
                return (
                  <RowGroup key={l.category}>
                    <tr>
                      <td>
                        <span className="cat-cell" onClick={() => { const n = new Set(open); if (n.has(l.category)) n.delete(l.category); else n.add(l.category); setOpen(n) }}>
                          <span className="dot" style={{ background: colour(l.category) }} />
                          {l.category}
                          {l.budgetSource === 'subcategories' && <span className="badge" title="Sum of subcategory budgets">sum</span>}
                        </span>
                      </td>
                      <td><BudgetBar actual={l.actual} budget={l.budget} /></td>
                      <td className="num">{money(l.actual)}</td>
                      <td className="num"><Input category={l.category} subcategory="" m={month} placeholder={l.budgetSource === 'default' ? String(l.budget) : l.budgetSource === 'subcategories' ? String(l.budget) : '—'} /></td>
                      <td className="num"><Input category={l.category} subcategory="" m="default" placeholder="—" /></td>
                      <td className={`num ${remaining !== null && remaining < 0 ? 'over' : ''}`}>{remaining === null ? <span className="muted">—</span> : money(remaining)}</td>
                    </tr>
                    {isOpen && l.subs.map((s) => {
                      const rem = s.budget === null ? null : s.budget - s.actual
                      return (
                        <tr className="sub-row" key={s.subcategory || '(none)'}>
                          <td>{s.subcategory || <i className="muted">no subcategory</i>}</td>
                          <td>{s.budget !== null && <BudgetBar actual={s.actual} budget={s.budget} />}</td>
                          <td className="num">{money(s.actual)}</td>
                          <td className="num">{s.subcategory && <Input category={l.category} subcategory={s.subcategory} m={month} placeholder={s.budget !== null ? String(s.budget) : '—'} />}</td>
                          <td className="num">{s.subcategory && <Input category={l.category} subcategory={s.subcategory} m="default" placeholder="—" />}</td>
                          <td className={`num ${rem !== null && rem < 0 ? 'over' : ''}`}>{rem === null ? '' : money(rem)}</td>
                        </tr>
                      )
                    })}
                  </RowGroup>
                )
              })}
              <tr className="total">
                <td>Total</td><td></td><td className="num">{money(t.spent)}</td><td className="num" colSpan={2}>{money(t.budgeted)}</td><td className={`num ${t.budgeted - t.spent < 0 ? 'over' : ''}`}>{money(t.budgeted - t.spent)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
