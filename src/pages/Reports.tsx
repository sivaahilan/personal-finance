import { useMemo, useState } from 'react'
import { addMonths, currentMonth, monthLabel, monthRange } from '../domain/dates.ts'
import { money, round2 } from '../domain/money.ts'
import { useAllTransactions, useCategories, useCategoryColours } from '../hooks.ts'
import { StackedBars, type Series } from '../components/charts/StackedBars.tsx'
import { downloadText, toCsv } from '../services/download.ts'

type Range = '6' | '12' | '24' | 'fy' | 'lastfy' | 'all'

/** Australian financial year runs July to June. */
function fyBounds(offset: number, now = currentMonth()): [string, string] {
  const [y, m] = now.split('-').map(Number)
  const fyStartYear = (m >= 7 ? y : y - 1) + offset
  return [`${fyStartYear}-07`, `${fyStartYear + 1}-06`]
}

export default function Reports() {
  const all = useAllTransactions()
  const categories = useCategories()
  const colour = useCategoryColours(categories)
  const [range, setRange] = useState<Range>('12')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const months = useMemo(() => {
    const now = currentMonth()
    const latest = all[0]?.month && all[0].month > now ? all[0].month : now
    if (range === 'fy') return monthRange(...fyBounds(0))
    if (range === 'lastfy') return monthRange(...fyBounds(-1))
    if (range === 'all') {
      const first = all.length ? all[all.length - 1].month : latest
      return monthRange(first, latest)
    }
    return monthRange(addMonths(latest, -(Number(range) - 1)), latest)
  }, [all, range])

  const data = useMemo(() => {
    const set = new Set(months)
    const idx = new Map(months.map((m, i) => [m, i]))
    const type = new Map(categories.map((c) => [c.name, c.type]))
    const cats = new Map<string, { total: number; byMonth: number[]; subs: Map<string, number[]> }>()
    for (const t of all) {
      if (!set.has(t.month)) continue
      const name = t.category ?? 'Uncategorised'
      let c = cats.get(name)
      if (!c) {
        c = { total: 0, byMonth: months.map(() => 0), subs: new Map() }
        cats.set(name, c)
      }
      const i = idx.get(t.month)!
      const v = type.get(name) === 'income' ? t.amount : -t.amount
      c.total += v
      c.byMonth[i] += v
      const sub = t.subcategory ?? ''
      let s = c.subs.get(sub)
      if (!s) {
        s = months.map(() => 0)
        c.subs.set(sub, s)
      }
      s[i] += v
    }
    const order = new Map(categories.map((c, i) => [c.name, i]))
    const rows = [...cats.entries()].map(([name, c]) => ({ name, type: type.get(name) ?? 'expense', ...c })).sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999))
    const expenses = rows.filter((r) => r.type === 'expense')
    const income = rows.filter((r) => r.type === 'income')
    const spendByMonth = months.map((_, i) => expenses.reduce((s, r) => s + r.byMonth[i], 0))
    const incomeByMonth = months.map((_, i) => income.reduce((s, r) => s + r.byMonth[i], 0))
    return { rows, expenses, income, spendByMonth, incomeByMonth }
  }, [all, months, categories])

  const series: Series[] = useMemo(() => {
    const top = [...data.expenses].sort((a, b) => b.total - a.total)
    const main = top.slice(0, 7)
    const rest = top.slice(7)
    const out: Series[] = main.map((r) => ({ name: r.name, colour: colour(r.name), values: r.byMonth }))
    if (rest.length) out.push({ name: `Other (${rest.length})`, colour: 'var(--other)', values: months.map((_, i) => rest.reduce((s, r) => s + r.byMonth[i], 0)) })
    // Draw in category order so colours stack consistently month to month.
    const order = new Map(categories.map((c, i) => [c.name, i]))
    return out.sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999))
  }, [data, months, colour, categories])

  function exportCsv() {
    const header = ['Category', 'Subcategory', ...months.map((m) => monthLabel(m, 'short')), 'Total']
    const body: (string | number)[][] = []
    for (const r of data.rows) {
      body.push([r.name, '', ...r.byMonth.map(round2), round2(r.total)])
      for (const [sub, vals] of r.subs) body.push([r.name, sub || '(none)', ...vals.map(round2), round2(vals.reduce((a, b) => a + b, 0))])
    }
    body.push(['Total spend', '', ...data.spendByMonth.map(round2), round2(data.spendByMonth.reduce((a, b) => a + b, 0))])
    body.push(['Total income', '', ...data.incomeByMonth.map(round2), round2(data.incomeByMonth.reduce((a, b) => a + b, 0))])
    downloadText(`expense-report-${months[0]}-to-${months[months.length - 1]}.csv`, toCsv([header, ...body]), 'text/csv')
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">{monthLabel(months[0])} to {monthLabel(months[months.length - 1])}</div>
        </div>
        <div className="row">
          <div className="seg">
            {([['6', '6 months'], ['12', '12 months'], ['24', '24 months'], ['fy', 'This FY'], ['lastfy', 'Last FY'], ['all', 'All']] as [Range, string][]).map(([k, label]) => (
              <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{label}</button>
            ))}
          </div>
          <button onClick={exportCsv} disabled={all.length === 0}>Download CSV</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Spending by month</h2></div>
        {data.expenses.length === 0 ? (
          <div className="empty">No categorised spending in this range.</div>
        ) : (
          <>
            <StackedBars months={months} series={series} />
            <div className="legend">
              {series.map((s) => (
                <span key={s.name}><i className="sw" style={{ background: s.colour }} />{s.name}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Category by month</h2>
          <span className="small muted">Click a category to see its subcategories</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Category</th>
                {months.map((m) => <th key={m} className="num">{monthLabel(m, 'short')}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <RowGroup key={r.name}>
                  <tr>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>
                      <span className="cat-cell" onClick={() => { const n = new Set(open); if (n.has(r.name)) n.delete(r.name); else n.add(r.name); setOpen(n) }}>
                        <span className="dot" style={{ background: colour(r.name === 'Uncategorised' ? null : r.name) }} />{r.name}
                      </span>
                    </td>
                    {r.byMonth.map((v, i) => <td key={i} className={`num ${v === 0 ? 'muted' : ''}`}>{v === 0 ? '·' : money(v, { whole: true })}</td>)}
                    <td className="num"><b>{money(r.total, { whole: true })}</b></td>
                  </tr>
                  {open.has(r.name) && [...r.subs.entries()].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).map(([sub, vals]) => (
                    <tr className="sub-row" key={sub}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>{sub || <i>no subcategory</i>}</td>
                      {vals.map((v, i) => <td key={i} className={`num ${v === 0 ? 'muted' : ''}`}>{v === 0 ? '·' : money(v, { whole: true })}</td>)}
                      <td className="num">{money(vals.reduce((a, b) => a + b, 0), { whole: true })}</td>
                    </tr>
                  ))}
                </RowGroup>
              ))}
              <tr className="total">
                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Spend</td>
                {data.spendByMonth.map((v, i) => <td key={i} className="num">{money(v, { whole: true })}</td>)}
                <td className="num">{money(data.spendByMonth.reduce((a, b) => a + b, 0), { whole: true })}</td>
              </tr>
              <tr className="total">
                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Income</td>
                {data.incomeByMonth.map((v, i) => <td key={i} className="num pos">{money(v, { whole: true })}</td>)}
                <td className="num pos">{money(data.incomeByMonth.reduce((a, b) => a + b, 0), { whole: true })}</td>
              </tr>
              <tr className="total">
                <td style={{ position: 'sticky', left: 0, background: 'var(--surface)' }}>Net</td>
                {data.incomeByMonth.map((v, i) => { const n = v - data.spendByMonth[i]; return <td key={i} className={`num ${n < 0 ? 'over' : 'pos'}`}>{money(n, { whole: true })}</td> })}
                <td className="num">{money(data.incomeByMonth.reduce((a, b) => a + b, 0) - data.spendByMonth.reduce((a, b) => a + b, 0), { whole: true })}</td>
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
