import setReleases from '@/lib/set-releases.json'

interface DataPoint {
  date: string
  total: number
  card_count?: number | null
}

interface CollectionChartProps {
  data: DataPoint[]
  width?: number
  height?: number
  labelFontSize?: number
  countFontSize?: number
  labelsOnMobile?: boolean
}

export default function CollectionChart({
  data,
  width = 600,
  height = 120,
  labelFontSize = 9,
  countFontSize = 11,
  labelsOnMobile = false,
}: CollectionChartProps) {
  if (data.length === 0) return null

  const padX = 48
  const padY = 16

  const totals = data.map(d => d.total)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const range = max - min || 1

  const x = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * (width - padX * 2)
  const y = (v: number) => padY + (1 - (v - min) / range) * (height - padY * 2)

  const firstDate = new Date(data[0].date).getTime()
  const lastDate = new Date(data[data.length - 1].date).getTime()
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

  const yLabels = [min, (min + max) / 2, max]
  const xIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1]

  const countMarkers: { i: number; delta: number }[] = []
  for (let k = 1; k < data.length; k++) {
    const prev = data[k - 1].card_count
    const curr = data[k].card_count
    if (curr != null && prev != null && curr !== prev) {
      countMarkers.push({ i: k, delta: curr - prev })
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className={labelsOnMobile ? undefined : 'hidden sm:block'}>
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={padX - 4} y={y(v) + 4} textAnchor="end" fontSize={labelFontSize} fill="#475569">${Math.round(v)}</text>
          </g>
        ))}
        {xIndices.map(i => (
          <text key={i} x={x(i)} y={height - 2} textAnchor="middle" fontSize={labelFontSize} fill="#475569">
            {data[i].date.slice(5)}
          </text>
        ))}
      </g>
      <g>
        {countMarkers.map(({ i, delta }) => {
          const cx = x(i)
          const isAdd = delta > 0
          const markerColor = isAdd ? '#4ade80' : '#f87171'
          const label = isAdd ? `+${delta}` : `${delta}`
          return (
            <g key={i}>
              <line x1={cx} y1={padY} x2={cx} y2={height - padY} stroke={markerColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <text x={cx} y={padY - 3} textAnchor="middle" fontSize={countFontSize} fontWeight="600" fill={markerColor}>{label}</text>
            </g>
          )
        })}
      </g>
      {releaseMarkers.map(r => (
        <line key={r.date} x1={dateToX(r.date)} y1={padY} x2={dateToX(r.date)} y2={height - padY} stroke="#a07848" strokeWidth="1" opacity="0.5" />
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      {data.length > 1
        ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        : <circle cx={x(0)} cy={y(data[0].total)} r="3" fill={color} />}
    </svg>
  )
}
