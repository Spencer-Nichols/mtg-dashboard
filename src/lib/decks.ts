import fs from 'fs'
import path from 'path'

const DECKS_FILE = path.join(process.env.HOME || '', '.claude/projects/-Users-spencer-Projects/memory/mtg_decks.md')

export interface DeckCard {
  name: string
  count: number
}

export interface Deck {
  slug: string
  title: string
  commander: string | null
  cards: DeckCard[]
  colors: string | null
}

export function loadDecks(): Deck[] {
  if (!fs.existsSync(DECKS_FILE)) return []
  const content = fs.readFileSync(DECKS_FILE, 'utf-8')

  // Split into deck sections by ## headings
  const sections = content.split(/\n(?=## )/).filter(s => s.trim().startsWith('##'))
  const decks: Deck[] = []

  for (const section of sections) {
    const lines = section.split('\n')
    const titleLine = lines[0].replace(/^##\s*/, '').trim()
    if (!titleLine || titleLine.toLowerCase().includes('memory') || titleLine.toLowerCase().includes('index')) continue

    const slug = titleLine.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Extract commander from "**Commander:** Name" pattern
    const commanderMatch = section.match(/\*\*Commander[^:]*:\*\*\s*(.+)/i)
    const commander = commanderMatch ? commanderMatch[1].trim() : null

    // Extract colors
    const colorMatch = section.match(/\*\*Colors[^:]*:\*\*\s*(.+)/i)
    const colors = colorMatch ? colorMatch[1].trim() : null

    // Extract cards from the Main Deck code block
    const mainDeckMatch = section.match(/###\s*Main Deck[\s\S]*?```([\s\S]*?)```/)
    const cards: DeckCard[] = []

    if (mainDeckMatch) {
      for (const line of mainDeckMatch[1].split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//')) continue
        const parts = trimmed.split(' ')
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
          const count = parseInt(parts[0])
          let name = parts.slice(1).join(' ').trim()
          // Strip alt-name annotations like "(The Ozolith)"
          name = name.replace(/\s*\([^)]+\)$/, '').trim()
          if (name) cards.push({ name, count })
        }
      }
    }

    if (cards.length > 0 || commander) {
      decks.push({ slug, title: titleLine, commander, cards, colors })
    }
  }

  return decks
}

export function loadDeck(slug: string): Deck | null {
  return loadDecks().find(d => d.slug === slug) ?? null
}
