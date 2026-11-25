'use client'

import { useMemo, useState } from 'react'
import { childTags, formatTag, matchTags } from '@/lib/tag-search'

const FAMILY_MIN_CHILDREN = 3
const MAX_ROWS = 60
const MAX_CHILDREN_SHOWN = 40

export function TagBrowser({ tags, activeTags, onPick }: {
  tags: string[] | null
  activeTags: string[]
  onPick: (slug: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const childCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!tags) return counts
    const tagSet = new Set(tags)
    for (const tag of tags) {
      const parts = tag.split('-')
      for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(0, i).join('-')
        if (tagSet.has(parent)) counts.set(parent, (counts.get(parent) ?? 0) + 1)
      }
    }
    return counts
  }, [tags])

  const rows = useMemo(() => {
    if (!tags) return []
    if (filter.trim()) return matchTags(tags, filter, MAX_ROWS)
    return [...childCounts.entries()]
      .filter(([, count]) => count >= FAMILY_MIN_CHILDREN)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ROWS)
      .map(([tag]) => tag)
  }, [tags, filter, childCounts])

  if (!tags) return <p className="text-xs text-stone-600">Loading tags…</p>

  return (
    <div className="space-y-2">
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder={`Filter ${tags.length.toLocaleString()} tags`}
        className="w-full bg-stone-800 border-2 border-stone-700 rounded-lg px-3 py-1.5 text-base sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600 transition-colors"
      />
      {!filter.trim() && <p className="text-xs text-stone-600 px-1">Biggest tag families</p>}
      <div className="max-h-[60vh] overflow-y-auto space-y-0.5 pr-1">
        {rows.map(tag => {
          const count = childCounts.get(tag) ?? 0
          const isActive = activeTags.includes(tag)
          const isExpanded = expanded === tag
          return (
            <div key={tag}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(isExpanded ? null : tag)}
                  disabled={count === 0}
                  className="w-5 text-stone-600 hover:text-stone-300 disabled:opacity-0"
                  aria-label={isExpanded ? `Collapse ${tag}` : `Expand ${tag}`}
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
                <button
                  onClick={() => onPick(tag)}
                  className={`flex-1 text-left text-sm truncate transition-colors ${isActive ? 'text-amber-300' : 'text-stone-400 hover:text-amber-400'}`}
                >
                  {formatTag(tag)}
                </button>
                {count > 0 && <span className="text-xs text-stone-600 font-mono">{count}</span>}
              </div>
              {isExpanded && (
                <div className="pl-6 py-1.5 flex flex-wrap gap-1">
                  {childTags(tags, tag).slice(0, MAX_CHILDREN_SHOWN).map(child => (
                    <button
                      key={child}
                      onClick={() => onPick(child)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        activeTags.includes(child)
                          ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/60 hover:text-amber-400'
                      }`}
                    >
                      {formatTag(child.slice(tag.length + 1))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && <p className="text-xs text-stone-600 px-1">No tags match.</p>}
      </div>
    </div>
  )
}
