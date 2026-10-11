/** Horizontal progress of actual against budget, with a marker at 100%. */
export function BudgetBar({ actual, budget }: { actual: number; budget: number | null }) {
  if (budget === null || budget <= 0) {
    return <div className="bar budget-line" aria-hidden="true"><span style={{ width: actual > 0 ? '100%' : 0, opacity: 0.35 }} /></div>
  }
  const ratio = actual / budget
  const scale = Math.max(1, ratio)
  const width = Math.min(100, (ratio / scale) * 100)
  const marker = (1 / scale) * 100
  const cls = ratio > 1 ? 'over' : ratio > 0.9 ? 'near' : ''
  return (
    <div className="bar budget-line" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={actual}>
      <span className={cls} style={{ width: `${width}%` }} />
      {ratio > 1 && <i style={{ left: `${marker}%` }} />}
    </div>
  )
}
