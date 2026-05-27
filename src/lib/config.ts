import path from 'path'
import { globSync } from 'glob'

export const SCRYFALL_DIR = path.join(process.env.HOME || '', 'Projects/scryfall')
export const BINDER_JSON_FILE = path.join(SCRYFALL_DIR, 'binder.json')
export const CACHE_FILE = path.join(SCRYFALL_DIR, 'price_cache.json')

export function getMoxfieldPath(): string | null {
  const files = globSync(path.join(SCRYFALL_DIR, 'moxfield_haves*.csv'))
  return files.length ? files[files.length - 1] : null
}
