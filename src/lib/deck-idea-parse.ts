import type { FoilType } from '@/lib/scryfall'

export type Board = 'commander' | 'main' | 'sideboard'

export interface ParsedLine {
  qty: number
  name: string
  setCode: string | null
  collectorNumber: string | null
  foilType: FoilType
  board: Board
}

export interface ParseResult {
  lines: ParsedLine[]
  unparsed: string[]
  // Whether commanders came from a header or a separated 1–2 card block; when false the caller should guess
  commandersDetected: boolean
}

const LINE_RE = /^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9]+)\)\s+(\S+))?(?:\s+\*([FE])\*)?$/
const HEADER_RE = /^(commanders?|sideboard|maybeboard|considering|companion|deck|main(?:board)?)\s*:?$/i

function headerBoard(header: string): Board | 'skip' {
  const h = header.toLowerCase()
  if (h.startsWith('commander')) return 'commander'
  if (h === 'sideboard' || h === 'companion') return 'sideboard'
  if (h === 'maybeboard' || h === 'considering') return 'skip'
  return 'main'
}

interface Block {
  board: Board | 'skip' | null
  lines: Omit<ParsedLine, 'board'>[]
}

export function normalizeCardName(name: string): string {
  return name.normalize('NFC').replace(/\s+\/\s+/g, ' // ').trim()
}

export function parseDecklist(text: string): ParseResult {
  const blocks: Block[] = []
  const unparsed: string[] = []
  let current: Block | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('//')) {
      current = null
      continue
    }
    const header = line.match(HEADER_RE)
    if (header) {
      current = { board: headerBoard(header[1]), lines: [] }
      blocks.push(current)
      continue
    }
    const m = line.match(LINE_RE)
    if (!m) {
      unparsed.push(line)
      continue
    }
    if (!current) {
      current = { board: null, lines: [] }
      blocks.push(current)
    }
    current.lines.push({
      qty: parseInt(m[1], 10),
      name: normalizeCardName(m[2]),
      setCode: m[3]?.toLowerCase() ?? null,
      collectorNumber: m[4] ?? null,
      foilType: m[5] === 'F' ? 'foil' : m[5] === 'E' ? 'etched' : 'none',
    })
  }

  const filled = blocks.filter(b => b.lines.length > 0)
  let commandersDetected = filled.some(b => b.board === 'commander')

  if (!commandersDetected) {
    const implicit = filled.filter(b => b.board === null)
    const isSmall = (b: Block) => b.lines.reduce((n, l) => n + l.qty, 0) <= 2
    if (implicit.length >= 2) {
      const first = implicit[0]
      const last = implicit[implicit.length - 1]
      if (filled[0] === first && isSmall(first)) {
        first.board = 'commander'
        commandersDetected = true
      } else if (isSmall(last)) {
        last.board = 'commander'
        commandersDetected = true
      }
    }
  }

  const merged = new Map<string, ParsedLine>()
  for (const block of filled) {
    if (block.board === 'skip') continue
    const board = block.board ?? 'main'
    for (const l of block.lines) {
      const key = [board, l.name.toLowerCase(), l.setCode, l.collectorNumber, l.foilType].join('|')
      const existing = merged.get(key)
      if (existing) existing.qty += l.qty
      else merged.set(key, { ...l, board })
    }
  }

  return { lines: [...merged.values()], unparsed, commandersDetected }
}
