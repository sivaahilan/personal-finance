import { useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema.ts'
import { parseBankCsv, type ColumnMapping, type ParseResult } from '../domain/csv.ts'
import { formatDate } from '../domain/dates.ts'
import { money } from '../domain/money.ts'
import { importRows, type ImportSummary } from '../services/importService.ts'
import { useToast } from '../components/Toast.tsx'

const ROLES: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount (signed)' },
  { key: 'debit', label: 'Debit (money out)' },
  { key: 'credit', label: 'Credit (money in)' },
  { key: 'balance', label: 'Balance' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
]

export default function ImportPage() {
  const toast = useToast()
  const [filename, setFilename] = useState('')
  const [text, setText] = useState('')
  const [override, setOverride] = useState<{ mapping?: ColumnMapping; hasHeader?: boolean }>({})
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [showMapping, setShowMapping] = useState(false)

  const parsed: ParseResult | null = useMemo(() => (text ? parseBankCsv(text, override) : null), [text, override])

  async function load(file: File) {
    setResult(null)
    setOverride({})
    setFilename(file.name)
    setText(await file.text())
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void load(f)
  }
  async function doImport() {
    if (!parsed || parsed.rows.length === 0) return
    setBusy(true)
    try {
      const r = await importRows(db, parsed.rows, filename || 'pasted.csv')
      setResult(r)
      setText('')
      toast(`Imported ${r.added} transaction${r.added === 1 ? '' : 's'}`)
    } finally {
      setBusy(false)
    }
  }
  function setRole(key: keyof ColumnMapping, index: number | undefined) {
    if (!parsed) return
    const m: ColumnMapping = { ...parsed.mapping }
    if (index === undefined) delete m[key]
    else m[key] = index
    setOverride({ ...override, mapping: m, hasHeader: parsed.hasHeader })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Import</h1>
          <div className="sub">Upload a CSV export from your bank. Duplicates are skipped, so overlapping exports are safe.</div>
        </div>
      </div>

      {result && (
        <div className="card notice good" style={{ marginBottom: 16 }}>
          <div className="row between">
            <div>
              <strong>{result.filename}</strong>: {result.added} added, {result.duplicates} already imported, {result.categorised} categorised, {result.uncategorised} to review.
            </div>
            <div className="row">
              {result.uncategorised > 0 && <Link className="btn primary" to="/review">Review {result.uncategorised}</Link>}
              <Link className="btn" to="/transactions">See transactions</Link>
            </div>
          </div>
        </div>
      )}

      {!text && (
        <div className="card">
          <label
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Drop a CSV here or click to choose a file</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              CommBank exports (Date, Amount, Description, Balance with no header) are detected automatically. Other banks work if the file has a header row. A spreadsheet export with Category and Subcategory columns keeps those categories.
            </div>
          </label>
          <details style={{ marginTop: 14 }}>
            <summary className="small">Or paste CSV text</summary>
            <textarea rows={6} style={{ width: '100%', marginTop: 8 }} placeholder={'01/02/2023,"-45.00","WOOLWORTHS 1160 GORDON","+1234.56"'} onBlur={(e) => { if (e.target.value.trim()) { setFilename('pasted.csv'); setText(e.target.value) } }} />
          </details>
        </div>
      )}

      {parsed && text && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>{filename}</h2>
              <div className="small muted">
                Detected {parsed.format === 'commbank' ? 'CommBank format' : parsed.hasHeader ? 'a header row' : 'columns by content'} · {parsed.rows.length} rows ready · {parsed.skipped.length} skipped
              </div>
            </div>
            <div className="row">
              <button onClick={() => setShowMapping((s) => !s)}>{showMapping ? 'Hide columns' : 'Adjust columns'}</button>
              <button onClick={() => { setText(''); setOverride({}) }}>Cancel</button>
              <button className="primary" disabled={busy || parsed.rows.length === 0} onClick={doImport}>
                Import {parsed.rows.length} rows
              </button>
            </div>
          </div>

          {showMapping && (
            <div className="notice" style={{ marginBottom: 12 }}>
              <label className="check" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={parsed.hasHeader} onChange={(e) => setOverride({ mapping: parsed.mapping, hasHeader: e.target.checked })} />
                First row is a header
              </label>
              <div className="form-grid">
                {ROLES.map((r) => (
                  <label className="field" key={r.key}>
                    {r.label}
                    <select value={parsed.mapping[r.key] ?? ''} onChange={(e) => setRole(r.key, e.target.value === '' ? undefined : Number(e.target.value))}>
                      <option value="">—</option>
                      {parsed.headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>Use either a signed Amount column, or separate Debit and Credit columns.</p>
            </div>
          )}

          {parsed.rows.length === 0 ? (
            <div className="notice crit">No rows could be read. Check the column mapping above.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Description</th><th className="num">Amount</th>{parsed.mapping.balance !== undefined && <th className="num">Balance</th>}{parsed.mapping.category !== undefined && <th>Category</th>}</tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td className="nowrap">{formatDate(r.date)}</td>
                      <td className="desc truncate">{r.description}</td>
                      <td className={`num ${r.amount > 0 ? 'pos' : ''}`}>{money(r.amount)}</td>
                      {parsed.mapping.balance !== undefined && <td className="num muted">{r.balance !== undefined ? money(r.balance) : ''}</td>}
                      {parsed.mapping.category !== undefined && <td>{r.category}{r.subcategory ? ` / ${r.subcategory}` : ''}</td>}
                    </tr>
                  ))}
                  {parsed.rows.length > 8 && (
                    <tr><td colSpan={5} className="muted small">… and {parsed.rows.length - 8} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {parsed.skipped.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className="small">{parsed.skipped.length} row{parsed.skipped.length === 1 ? '' : 's'} skipped</summary>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {parsed.skipped.slice(0, 20).map((s) => (
                      <tr key={s.line}><td className="num small">{s.line}</td><td className="small">{s.reason}</td><td className="small mono truncate">{s.raw.join(', ')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
