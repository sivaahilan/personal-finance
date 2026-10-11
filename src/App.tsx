import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema.ts'
import Dashboard from './pages/Dashboard.tsx'
import ImportPage from './pages/Import.tsx'
import Transactions from './pages/Transactions.tsx'
import Review from './pages/Review.tsx'
import Rules from './pages/Rules.tsx'
import Budgets from './pages/Budgets.tsx'
import Reports from './pages/Reports.tsx'
import Settings from './pages/Settings.tsx'
import { ToastProvider } from './components/Toast.tsx'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/import', label: 'Import' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/review', label: 'Review' },
  { to: '/rules', label: 'Rules' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export default function App() {
  const uncategorised = useLiveQuery(() => db.transactions.filter((t) => !t.category).count(), [], 0)
  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)" /><path d="M8 22V12l5 6 5-9 6 13" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Expense Tracker
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                {n.label}
                {n.to === '/review' && uncategorised > 0 && <span className="badge warn">{uncategorised}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="foot small muted">Data stays in this browser. Back up from Settings.</div>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/review" element={<Review />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}
