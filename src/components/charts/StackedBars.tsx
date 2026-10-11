import { money } from '../../domain/money.ts'
import { monthLabel } from '../../domain/dates.ts'
import { useTooltip } from './Tooltip.tsx'

export interface Series {
  name: string
  colour: string
  values: number[]
}

/**
 * Monthly stacked bars, one stack per month. Segments get a 2px surface gap;
 * the top of each stack is rounded. Hover shows the month breakdown.
 */
export function StackedBars({ months, series, height = 240 }: { months: string[]; series: Series[]; height?: number }) {
  const tip = useTooltip()
  const width = 720
  const pad = { l: 54, r: 8, t: 10, b: 26 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const totals = months.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0))
  const max = Math.max(1, ...totals)
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const y = (v: number) => pad.t + h - (v / top) * h
  const slot = w / Math.max(1, months.length)
  const bw = Math.min(42, slot * 0.62)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  // Thin out month labels on long ranges so they never overlap.
  const labelEvery = Math.max(1, Math.ceil(months.length / 12))
  const label = (m: string, i: number) => {
    if (i % labelEvery !== 0) return ''
    const short = monthLabel(m, 'short')
    return labelEvery > 1 || m.endsWith('-01') ? short.replace(/ (\d{2})(\d{2})$/, ' $2') : short.replace(/ \d{4}$/, '')
  }

  return (
    <div className="viz">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly spending by category">
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'baseline' : 'grid-line'} x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">{money(v, { whole: true })}</text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = pad.l + slot * i + slot / 2
          let acc = 0
          const segs = series
            .map((s) => ({ s, v: Math.max(0, s.values[i] ?? 0) }))
            .filter((x) => x.v > 0)
          return (
            <g
              key={m}
              onMouseMove={(e) =>
                tip.show(
                  e,
                  <div>
                    <b>{monthLabel(m)}</b>
                    {segs
                      .slice()
                      .reverse()
                      .map((x) => (
                        <div className="l" key={x.s.name}>
                          <span>{x.s.name}</span>
                          <span>{money(x.v)}</span>
                        </div>
                      ))}
                    <div className="l" style={{ marginTop: 4, fontWeight: 600 }}>
                      <span>Total</span>
                      <span>{money(totals[i])}</span>
                    </div>
                  </div>,
                )
              }
              onMouseLeave={tip.hide}
            >
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={h} fill="transparent" />
              {segs.map((x, j) => {
                const y0 = y(acc)
                acc += x.v
                const y1 = y(acc)
                const isTop = j === segs.length - 1
                const segH = Math.max(0, y0 - y1 - 2)
                return <rect key={x.s.name} x={cx - bw / 2} y={y1 + (isTop ? 0 : 1)} width={bw} height={segH} fill={x.s.colour} rx={isTop ? 4 : 0} />
              })}
              <text x={cx} y={height - 8} textAnchor="middle">{label(m, i)}</text>
            </g>
          )
        })}
      </svg>
      {tip.node}
    </div>
  )
}

function niceStep(max: number): number {
  const raw = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  const f = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return f * mag
}
