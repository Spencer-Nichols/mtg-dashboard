import fs from 'fs'
import path from 'path'

const WISHLIST_FILE = path.join(
  process.env.HOME || '',
  '.claude/projects/-Users-spencer-Projects/memory/mtg_decks_wishlist.md'
)

export interface WishlistDeck {
  title: string
  commander: string | null
  colors: string | null
  estimatedCost: string | null
  bracket: string | null
}

export interface WishlistSingle {
  name: string
  note: string | null
  setCode: string | null
  scryfallId: string | null
}

export interface WishlistData {
  decks: WishlistDeck[]
  singles: WishlistSingle[]
}

export function loadWishlist(): WishlistData {
  if (!fs.existsSync(WISHLIST_FILE)) return { decks: [], singles: [] }
  const content = fs.readFileSync(WISHLIST_FILE, 'utf-8')

  const sections = content.split(/\n(?=## )/).filter(s => s.trim().startsWith('##'))
  const decks: WishlistDeck[] = []
  let singles: WishlistSingle[] = []

  for (const section of sections) {
    const lines = section.split('\n')
    const title = lines[0].replace(/^##\s*/, '').trim()
    if (!title) continue

    // Singles section
    if (title.toLowerCase().includes('singles')) {
      const codeMatch = section.match(/```([\s\S]*?)```/)
      if (codeMatch) {
        for (const line of codeMatch[1].split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('//')) continue
          // Format: "1 Card Name // optional note"
          const [cardPart, ...noteParts] = trimmed.split('//')
          const parts = cardPart.trim().split(' ')
          if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
            let name = parts.slice(1).join(' ').trim()
            const setCodeMatch = name.match(/\[([a-z0-9]+)(?::([0-9a-f-]+))?\]$/)
            const setCode = setCodeMatch ? setCodeMatch[1] : null
            const scryfallId = setCodeMatch?.[2] ?? null
            if (setCode) name = name.slice(0, name.lastIndexOf('[')).trim()
            const note = noteParts.length ? noteParts.join('//').trim() : null
            if (name) singles.push({ name, note, setCode, scryfallId })
          }
        }
      }
      continue
    }

    // Deck section
    const commanderMatch = section.match(/\*\*Commander[^:]*:\*\*\s*(.+)/i)
    const colorsMatch = section.match(/\*\*Colors[^:]*:\*\*\s*(.+)/i)
    const costMatch = section.match(/\*\*Estimated Cost[^:]*:\*\*\s*(.+)/i)
    const bracketMatch = section.match(/\*\*Bracket[^:]*:\*\*\s*(.+)/i)

    // Skip sub-sections like "Budget Version"
    if (title.toLowerCase().includes('budget')) continue

    decks.push({
      title,
      commander: commanderMatch ? commanderMatch[1].trim() : null,
      colors: colorsMatch ? colorsMatch[1].trim() : null,
      estimatedCost: costMatch ? costMatch[1].trim() : null,
      bracket: bracketMatch ? bracketMatch[1].trim() : null,
    })
  }

  return { decks, singles }
}
