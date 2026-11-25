import { KEYWORDS, type Keyword } from '@/lib/keywords'

export interface Role {
  label: string
  tag: string
  keywordCategory?: string
}

export const ROLES: Role[] = [
  { label: 'Ramp', tag: 'ramp', keywordCategory: 'Ramp' },
  { label: 'Draw', tag: 'draw', keywordCategory: 'Card Advantage' },
  { label: 'Removal', tag: 'removal', keywordCategory: 'Removal' },
  { label: 'Wipe', tag: 'sweeper' },
  { label: 'Counter', tag: 'counterspell' },
  { label: 'Tutor', tag: 'tutor' },
  { label: 'Protection', tag: 'gives-protection' },
  { label: 'Recursion', tag: 'recursion' },
]

let tagsPromise: Promise<string[]> | null = null

export function loadTags(): Promise<string[]> {
  if (!tagsPromise) tagsPromise = import('@/data/scryfall-tags.json').then(m => m.default as string[])
  return tagsPromise
}

export function formatTag(slug: string): string {
  const words = slug.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function matchTags(tags: string[], text: string, limit: number): string[] {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const joined = words.join('-')

  const matches = tags.filter(tag => {
    const segments = tag.split('-')
    return words.every(word => segments.some(segment => segment.startsWith(word)))
  })

  const rank = (tag: string) => {
    if (tag === joined) return 0
    if (tag.startsWith(joined)) return 1
    return 2
  }
  matches.sort((a, b) => rank(a) - rank(b) || a.split('-').length - b.split('-').length || a.localeCompare(b))
  return matches.slice(0, limit)
}

export function matchKeywords(text: string, limit: number): Keyword[] {
  const needle = text.toLowerCase().trim()
  if (needle.length < 2) return []
  return KEYWORDS
    .filter(k => k.label.toLowerCase().startsWith(needle) || k.aliases.some(a => a.startsWith(needle)))
    .slice(0, limit)
}

export function childTags(tags: string[], slug: string): string[] {
  return tags.filter(t => t.startsWith(`${slug}-`))
}

export function relatedKeywords(slug: string): Keyword[] {
  const role = ROLES.find(r => r.tag === slug)
  if (!role?.keywordCategory) return []
  return KEYWORDS.filter(k => k.category === role.keywordCategory && k.slug !== slug)
}
