import fs from 'fs'
import { BINDER_JSON_FILE } from './config'

export interface BinderEntry {
  displayName: string
  baseName: string
  setCode: string
  scryfallId: string | null
  foil: boolean
  count: number
  snapshotPrice: number
  note: string | null
  dateAdded: string | null
}

export function readBinder(): BinderEntry[] {
  if (!fs.existsSync(BINDER_JSON_FILE)) return []
  try { return JSON.parse(fs.readFileSync(BINDER_JSON_FILE, 'utf-8')) } catch { return [] }
}

export function writeBinder(entries: BinderEntry[]): void {
  fs.writeFileSync(BINDER_JSON_FILE, JSON.stringify(entries, null, 2))
}
