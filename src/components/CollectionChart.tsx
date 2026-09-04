'use client'

import { useRef, useState, type MouseEvent } from 'react'
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
  showMarkers?: boolean
}

type Marker = { id: string; x: number; label: string; color: string }

export default function CollectionChart({
  data,
  width = 600,
  height = 120,
  labelFontSize = 9,
  countFontSize = 11,
  labelsOnMobile = false,
  events = [],
  showMarkers = true,
}: CollectionChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

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

  // Merge window scales with the chart's total span so a multi-month view doesn't
  // spawn a separate tick for every import that happened within a few hours of another.
  const spanMs = lastDate - firstDate
  const mergeWindowMs = Math.max(4 * 60 * 60 * 1000, spanMs * 0.01)
  const countMarkers: { x: number; delta: number; lastTs: number }[] = []
  for (let k = 1; k < data.length; k++) {
    const prev = data[k - 1].card_count
    const curr = data[k].card_count
    if (curr != null && prev != null && curr !== prev) {
      const ts = new Date(data[k].date).getTime()
      const last = countMarkers[countMarkers.length - 1]
      if (last && ts - last.lastTs <= mergeWindowMs) {
        last.delta += curr - prev
        last.x = x(k)
        last.lastTs = ts
      } else {
        countMarkers.push({ x: x(k), delta: curr - prev, lastTs: ts })
      }
    }
  }

  const visibleCountMarkers = countMarkers.filter(m => m.delta !== 0)

  const countMarkerList: Marker[] = visibleCountMarkers.map((m, idx) => ({
    id: `count-${idx}`,
    x: m.x,
    label: m.delta > 0 ? `+${m.delta}` : `${m.delta}`,
    color: m.delta > 0 ? '#4ade80' : '#f87171',
  }))
  const releaseMarkerList: Marker[] = releaseMarkers.map(r => ({
    id: `release-${r.date}`,
    x: dateToX(r.date),
    label: r.name,
    color: '#a07848',
  }))
  const eventMarkerList: Marker[] = events
    .filter(e => {
      const t = new Date(e.date).getTime()
      return t >= firstDate && t <= lastDate
    })
    .map(e => ({ id: `event-${e.id}`, x: dateToX(e.date), label: e.label, color: '#f59e0b' }))

  const allMarkers = [...countMarkerList, ...releaseMarkerList, ...eventMarkerList]
  const active = allMarkers.find(m => m.id === activeId) ?? null

  const estimateTooltipWidth = (label: string) => Math.max(36, label.length * 6.2 + 16)
  const tooltipWidth = active ? estimateTooltipWidth(active.label) : 0
  const tooltipX = active ? Math.min(Math.max(active.x, padX + tooltipWidth / 2 - 4), width - padX - tooltipWidth / 2 + 4) : 0

  // Nearest-marker snapping: one big tap/hover strip instead of per-marker hit targets,
  // so markers stay tappable on mobile without needing tiny precise touch zones.
  const NEAREST_THRESHOLD = width * 0.025
  const findNearestMarker = (clientX: number): Marker | null => {
    if (!svgRef.current || allMarkers.length === 0) return null
    const rect = svgRef.current.getBoundingClientRect()
    const localX = (clientX - rect.left) * (width / rect.width)
    let nearest = allMarkers[0]
    let bestDist = Math.abs(nearest.x - localX)
    for (const m of allMarkers) {
      const d = Math.abs(m.x - localX)
      if (d < bestDist) { nearest = m; bestDist = d }
    }
    return bestDist <= NEAREST_THRESHOLD ? nearest : null
  }
  const handleMarkerInteract = (e: MouseEvent) => {
    const nearest = findNearestMarker(e.clientX)
    setActiveId(nearest?.id ?? null)
  }

  return (
    <svg ref={svgRef} viewBox={`0 -20 ${width} ${height + 32}`} className="w-full">
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
      {showMarkers && (
        <g pointerEvents="none">
          {allMarkers.map(m => {
            const isActive = m.id === activeId
            const dashed = !m.id.startsWith('release-')
            const dotY = 12
            return (
              <g key={m.id}>
                <line
                  x1={m.x} y1={dotY + 4} x2={m.x} y2={height}
                  stroke={m.color}
                  strokeWidth="1"
                  strokeDasharray={dashed ? (m.id.startsWith('event-') ? '4 2' : '3 3') : undefined}
                  opacity={isActive ? 0.35 : 0.15}
                />
                <circle cx={m.x} cy={dotY} r={isActive ? 5.5 : 4} fill={m.color} stroke="#0f172a" strokeWidth="1.5" opacity={isActive ? 1 : 0.85} />
              </g>
            )
          })}
        </g>
      )}
      <g clipPath={`url(#${gradId}-clip)`}>
        <path d={area} fill={`url(#${gradId})`} />
        {data.length > 1
          ? <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          : <circle cx={x(0)} cy={y(data[0].total)} r="3" fill={color} />}
      </g>
      {showMarkers && allMarkers.length > 0 && (
        <rect
          x="0" y="-20" width={width} height={height + 32}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseMove={handleMarkerInteract}
          onMouseLeave={() => setActiveId(null)}
          onClick={handleMarkerInteract}
        />
      )}
      {active && (
        <g pointerEvents="none">
          <rect
            x={tooltipX - tooltipWidth / 2} y={-18} width={tooltipWidth} height={16} rx={3}
            fill="#0f172a" stroke={active.color} strokeWidth="1" opacity="0.95"
          />
          <text x={tooltipX} y={-6} textAnchor="middle" fontSize={10} fontWeight="600" fill={active.color}>
            {active.label}
          </text>
        </g>
      )}
    </svg>
  )
}
