import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema.ts'
import { currentMonth, formatDate, monthLabel } from '../domain/dates.ts'
import { money } from '../domain/money.ts'
import { buildBudgetLines, totals } from '../services/budgets.ts'
import { useAvailableMonths, useBudgets, useCategories, useCategoryColours, useMonthTransactions } from '../hooks.ts'
import { MonthPicker } from '../components/MonthPicker.tsx'
import { BudgetBar } from '../components/charts/BudgetBar.tsx'

export default function Dashboard() {
  const months = useAvailableMonths()
  const [month, setMonth] = useState(() => currentMonth())
  const categories = useCategories()
  const budgets = useBudgets()
  const txs = useMonthTransactions(month)
  const colour = useCategoryColours(categories)
  const total = useLiveQuery(() => db.transactions.count(), [], 0)
  const uncategorised = useLiveQuery(() => db.transactions.filter((t) => !t.category).count(), [], 0)
  const imports = useLiveQuery(() => db.imports.orderBy('importedAt').reverse().limit(5).toArray(), [], [])

  const lines = useMemo(() => buildBudgetLines(categories, budgets, txs, month), [categories, budgets, txs, month])
  const t = totals(lines)
  const expenseLines = lines.filter((l) => l.type === 'expense').sort((a, b) => b.actual - a.actual)
  const latest = months[0]

  if (total === 0) {
    return (
      <div>
        <div className="page-head"><h1>Dashboard</h1></div>
        <div className="card empty">
          <strong>No transactions yet</strong>
          Import a CSV from your bank to get started. Rules will categorise what they can, and you review the rest.
          <div style={{ marginTop: 14 }}>
            <Link className="btn primary" to="/import">Import a CSV</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{monthLabel(month)}{latest && latest !== month && <> · latest data is {monthLabel(latest)}</>}</div>
        </div>
        <MonthPicker month={month} onChange={setMonth} months={months} />
      </div>

      <div className="grid tiles">
        <div className="tile">
          <div className="label">Spent</div>
          <div className="value">{money(t.spent, { whole: true })}</div>
          {t.hasBudget && <div className="delta">of {money(t.budgeted, { whole: true })} budgeted</div>}
        </div>
        <div className="tile">
          <div className="label">{t.hasBudget ? 'Budget remaining' : 'Income'}</div>
          <div className={`value ${t.hasBudget && t.budgeted - t.spent < 0 ? 'over' : ''}`}>{money(t.hasBudget ? t.budgeted - t.spent : t.income, { whole: true })}</div>
          {t.hasBudget && <div className="delta">income {money(t.income, { whole: true })}</div>}
        </div>
        <div className="tile">
          <div className="label">Net</div>
          <div className={`value ${t.income - t.spent < 0 ? '' : 'pos'}`}>{money(t.income - t.spent, { whole: true })}</div>
          <div className="delta">{txs.length} transactions</div>
        </div>
        <div className="tile">
          <div className="label">Needs review</div>
          <div className="value">{uncategorised}</div>
          <div className="delta">{uncategorised > 0 ? <Link to="/review">Categorise them</Link> : 'All categorised'}</div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <h2>Spending by category</h2>
            <Link to="/budgets" className="small">Set budgets</Link>
          </div>
          {expenseLines.length === 0 ? (
            <div className="empty">Nothing categorised for this month yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <tbody>
                  {expenseLines.map((l) => (
                    <tr key={l.category}>
                      <td style={{ width: '32%' }}>
                        <span className="cat-cell" style={{ cursor: 'default' }}>
                          <span className="dot" style={{ background: colour(l.category) }} />
                          {l.category}
                        </span>
                      </td>
                      <td><BudgetBar actual={l.actual} budget={l.budget} /></td>
                      <td className="num">{money(l.actual)}</td>
                      <td className={`num small ${l.budget !== null && l.actual > l.budget ? 'over' : 'muted'}`} style={{ width: 90 }}>
                        {l.budget !== null ? `${Math.round((l.actual / l.budget) * 100)}%` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Recent imports</h2>
            <Link to="/import" className="small">Import CSV</Link>
          </div>
          {imports.length === 0 ? (
            <div className="empty">No imports yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>File</th><th>When</th><th className="num">Added</th><th className="num">Skipped</th><th className="num">Unmatched</th></tr>
                </thead>
                <tbody>
                  {imports.map((i) => (
                    <tr key={i.id}>
                      <td className="truncate" style={{ maxWidth: 180 }}>{i.filename}</td>
                      <td className="nowrap small">{formatDate(i.importedAt.slice(0, 10))}</td>
                      <td className="num">{i.added}</td>
                      <td className="num">{i.duplicates}</td>
                      <td className="num">{i.uncategorised}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
