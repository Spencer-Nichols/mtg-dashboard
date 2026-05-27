import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { getMoxfieldPath } from './config'

export type CollectionStatus = 'owned' | 'proxy' | 'not_owned'

let _cache: Map<string, CollectionStatus> | null = null

export function getCollectionStatus(cardName: string): CollectionStatus {
  if (!_cache) _cache = buildCache()
  return _cache.get(cardName.toLowerCase()) ?? 'not_owned'
}

function buildCache(): Map<string, CollectionStatus> {
  const map = new Map<string, CollectionStatus>()
  const csvPath = getMoxfieldPath()
  if (!csvPath) return map

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  for (const row of rows) {
    const name = (row['Name'] || '').trim().toLowerCase()
    if (!name) continue
    const isProxy = (row['Proxy'] || '').trim().toLowerCase() === 'true'
    const tags = (row['Tags'] || '').trim().toLowerCase()
    const isPlaytest = tags.includes('playtest')

    if (isProxy || isPlaytest) {
      if (!map.has(name)) map.set(name, 'proxy')
    } else {
      map.set(name, 'owned')
    }
  }

  return map
}
