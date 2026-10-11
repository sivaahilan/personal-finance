import { addMonths, monthLabel } from '../domain/dates.ts'

export function MonthPicker({ month, onChange, months }: { month: string; onChange: (m: string) => void; months?: string[] }) {
  const options = months && months.length ? (months.includes(month) ? months : [month, ...months]) : [month]
  return (
    <div className="row" role="group" aria-label="Month">
      <button className="icon" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>‹</button>
      <select value={month} onChange={(e) => onChange(e.target.value)} aria-label="Select month">
        {options.map((m) => (
          <option key={m} value={m}>{monthLabel(m)}</option>
        ))}
      </select>
      <button className="icon" aria-label="Next month" onClick={() => onChange(addMonths(month, 1))}>›</button>
    </div>
  )
}
