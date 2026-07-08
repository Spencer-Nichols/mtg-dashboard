import setReleases from '@/lib/set-releases.json'

interface DataPoint {
  date: string
  total: number
  card_count?: number | null
}

export interface ChartEvent {
  id: string
  date: string
  label: string
}

interface CollectionChartProps {
  data: DataPoint[]
  width?: number
  height?: number
  labelFontSize?: number
  countFontSize?: number
  labelsOnMobile?: boolean
  events?: ChartEvent[]
}

export default function CollectionChart({
  data,
  width = 600,
  height = 120,
  labelFontSize = 9,
  countFontSize = 11,
  labelsOnMobile = false,
  events = [],
}: CollectionChartProps) {
  if (data.length === 0) return null

  const padX = 48
  const padY = 16

  const totals = data.map(d => d.total)
  const sorted = [...totals].sort((a, b) => a - b)
  const p05 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))]
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const clippedRange = p95 - p05 || 1
  const buffer = clippedRange * 0.1
  const yMin = p05 - buffer
  const yMax = Math.max(p95, max) + buffer
  const range = yMax - yMin

  const y = (v: number) => padY + (1 - (v - yMin) / range) * (height - padY * 2)

  const firstDate = new Date(data[0].date).getTime()
  const lastDate = new Date(data[data.length - 1].date).getTime()
  const x = (i: number) => {
    const d = new Date(data[i].date).getTime()
    if (lastDate === firstDate) return padX
    return padX + ((d - firstDate) / (lastDate - firstDate)) * (width - padX * 2)
  }
  const dateToX = (dateStr: string) => {
    const d = new Date(dateStr).getTime()
    if (lastDate === firstDate) return padX
    return padX + ((d - firstDate) / (lastDate - firstDate)) * (width - padX * 2)
  }
  const releaseMarkers = data.length > 1
    ? setReleases.filter(r => {
        const t = new Date(r.date).getTime()
        return t >= firstDate && t <= lastDate
      })
    : []

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ')
  const area = `M${x(0).toFixed(1)},${height} ` +
    data.map((d, i) => `L${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(' ') +
    ` L${x(data.length - 1).toFixed(1)},${height} Z`

  const trend = data.length > 1 ? data[data.length - 1].total - data[0].total : 0
  const color = trend >= 0 ? '#4ade80' : '#f87171'

  const gradId = `collectionChart-${width}-${height}`

  const yLabels = [yMin, (yMin + yMax) / 2, yMax]
  const MIN_LABEL_GAP = 40
  const candidateIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1]
  const xIndices: number[] = []
  for (const i of candidateIndices) {
    const last = xIndices[xIndices.length - 1]
    if (last === undefined || x(i) - x(last) >= MIN_LABEL_GAP) xIndices.push(i)
  }

  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
  const countMarkers: { x: number; delta: number; lastTs: number }[] = []
  for (let k = 1; k < data.length; k++) {
    const prev = data[k - 1].card_count
    const curr = data[k].card_count
    if (curr != null && prev != null && curr !== prev) {
      const ts = new Date(data[k].date).getTime()
      const last = countMarkers[countMarkers.length - 1]
      if (last && ts - last.lastTs <= FOUR_HOURS_MS) {
        last.delta += curr - prev
        last.x = x(k)
        last.lastTs = ts
      } else {
        countMarkers.push({ x: x(k), delta: curr - prev, lastTs: ts })
      }
    }
  }

  const visibleCountMarkers = countMarkers.filter(m => m.delta !== 0)

  return (
    <svg viewBox={`0 -20 ${width} ${height + 32}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${gradId}-clip`}>
          <rect x={padX} y={0} width={width - padX * 2} height={height} />
        </clipPath>
      </defs>
      <g className={labelsOnMobile ? undefined : 'hidden sm:block'}>
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={padX - 4} y={y(v) + 4} textAnchor="end" fontSize={labelFontSize} fill="#475569">${Math.round(v)}</text>
          </g>
        ))}
        {xIndices.map(i => {
          const d = data[i].date
          const label = d.length > 10 ? `${d.slice(5, 10)} ${d.slice(11, 13)}h` : d.slice(5, 10)
          return (
            <text key={i} x={x(i)} y={height + 10} textAnchor="middle" fontSize={labelFontSize} fill="#475569">
              {label}
            </text>
          )
        })}
      </g>
      <g>
        {visibleCountMarkers.map(({ x: cx, delta }, idx) => {
          const isAdd = delta > 0
          const markerColor = isAdd ? '#4ade80' : '#f87171'
          const label = isAdd ? `+${delta}` : `${delta}`
          return (
            <g key={idx}>
              <line x1={cx} y1={4} x2={cx} y2={height} stroke={markerColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <text x={cx} y={-2} dominantBaseline="auto" textAnchor="middle" fontSize={countFontSize} fontWeight="600" fill={markerColor}>{label}</text>
            </g>
          )
        })}
      </g>
      {releaseMarkers.map(r => {
        const rx = dateToX(r.date)
        const label = r.name.length <= 10 ? r.name : r.code
        return (
          <g key={r.date}>
            <line x1={rx} y1={4} x2={rx} y2={height} stroke="#a07848" strokeWidth="1" opacity="0.5" />
            <text x={rx} y={-2} dominantBaseline="auto" textAnchor="middle" fontSize="7" fill="#a07848" opacity="0.8">{label}</text>
          </g>
        )
      })}
      {events.filter(e => {
        const t = new Date(e.date).getTime()
        return t >= firstDate && t <= lastDate
      }).map(e => {
        const ex = dateToX(e.date)
        const label = e.label.length <= 12 ? e.label : e.label.slice(0, 11) + '…'
        return (
          <g key={e.id}>
            <line x1={ex} y1={4} x2={ex} y2={height} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 2" opacity="0.7" />
            <text x={ex} y={-9} dominantBaseline="auto" textAnchor="middle" fontSize="7" fill="#f59e0b" opacity="0.9">{label}</text>
          </g>
        )
      })}
      <g clipPath={`url(#${gradId}-clip)`}>
        <path d={area} fill={`url(#${gradId})`} />
        {data.length > 1
          ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          : <circle cx={x(0)} cy={y(data[0].total)} r="3" fill={color} />}
      </g>
    </svg>
  )
}
