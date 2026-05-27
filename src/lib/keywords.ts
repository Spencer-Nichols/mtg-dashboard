export interface Keyword {
  label: string
  slug: string
  aliases: string[]
  category: string
}

export const KEYWORDS: Keyword[] = [
  // ── Card Advantage ───────────────────────────────────────
  { label: 'Card Draw', slug: 'draw', aliases: ['draw', 'card draw', 'draw cards'], category: 'Card Advantage' },
  { label: 'Draw Engine', slug: 'draw-engine', aliases: ['draw engine', 'repeatable draw', 'card engine'], category: 'Card Advantage' },
  { label: 'Cantrip', slug: 'cantrip', aliases: ['cantrip', 'draw one', 'draw a card'], category: 'Card Advantage' },
  { label: 'Scry', slug: 'scry', aliases: ['scry', 'top of library', 'topdeck'], category: 'Card Advantage' },
  { label: 'Wheel', slug: 'wheel', aliases: ['wheel', 'wheel of fortune', 'draw seven', 'refill hand'], category: 'Card Advantage' },
  { label: 'Loot', slug: 'loot', aliases: ['loot', 'looting', 'draw discard'], category: 'Card Advantage' },
  { label: 'Mill', slug: 'mill', aliases: ['mill', 'milling', 'mill opponent'], category: 'Card Advantage' },

  // ── Ramp ─────────────────────────────────────────────────
  { label: 'Ramp', slug: 'ramp', aliases: ['ramp', 'mana ramp', 'acceleration', 'fast mana'], category: 'Ramp' },
  { label: 'Mana Rock', slug: 'mana-rock', aliases: ['mana rock', 'rock', 'rocks', 'artifact ramp'], category: 'Ramp' },
  { label: 'Mana Dork', slug: 'mana-dork', aliases: ['mana dork', 'dork', 'creature ramp', 'elf ramp'], category: 'Ramp' },
  { label: 'Land Ramp', slug: 'land-ramp', aliases: ['land ramp', 'land search', 'fetch land', 'land tutoring'], category: 'Ramp' },
  { label: 'Mana Doubler', slug: 'mana-doubler', aliases: ['mana doubler', 'double mana', 'mana multiplier'], category: 'Ramp' },
  { label: 'Mana Sink', slug: 'mana-sink', aliases: ['mana sink', 'mana outlet', 'dump mana', 'spend mana'], category: 'Ramp' },

  // ── Removal ───────────────────────────────────────────────
  { label: 'Removal', slug: 'removal', aliases: ['removal', 'kill', 'destroy', 'exile target'], category: 'Removal' },
  { label: 'Board Wipe', slug: 'board-wipe', aliases: ['board wipe', 'wrath', 'sweeper', 'boardwipe', 'mass removal', 'wipe the board'], category: 'Removal' },
  { label: 'Bounce', slug: 'bounce', aliases: ['bounce', 'return to hand', 'unsummon', 'tempo'], category: 'Removal' },

  // ── Control ───────────────────────────────────────────────
  { label: 'Counterspell', slug: 'counterspell', aliases: ['counter', 'counterspell', 'counter spell', 'negate', 'deny'], category: 'Control' },
  { label: 'Tutor', slug: 'tutor', aliases: ['tutor', 'search library', 'fetch', 'find card'], category: 'Control' },
  { label: 'Tax', slug: 'tax', aliases: ['tax', 'cost more', 'stax', 'slow down', 'punish'], category: 'Control' },
  { label: 'Discard', slug: 'discard', aliases: ['discard', 'hand disruption', 'strip hand', 'thoughtseize'], category: 'Control' },
  { label: 'Protection', slug: 'protection', aliases: ['protection', 'hexproof', 'shroud', 'ward', 'indestructible', 'protect'], category: 'Control' },
  { label: 'Pillowfort', slug: 'pillowfort', aliases: ['pillowfort', 'pillow fort', 'can\'t attack me', 'deflect', 'fog', 'prevent combat'], category: 'Control' },
  { label: 'Fog', slug: 'fog', aliases: ['fog', 'prevent all combat damage', 'safe from combat'], category: 'Control' },
  { label: 'Extra Turn', slug: 'extra-turn', aliases: ['extra turn', 'take another turn', 'time walk', 'extra turns'], category: 'Control' },

  // ── Graveyard ────────────────────────────────────────────
  { label: 'Reanimate', slug: 'reanimate', aliases: ['reanimate', 'reanimation', 'resurrect', 'return from graveyard', 'rise from grave'], category: 'Graveyard' },
  { label: 'Self Mill', slug: 'self-mill', aliases: ['self mill', 'fill graveyard', 'mill myself', 'dredge', 'entomb'], category: 'Graveyard' },
  { label: 'Death Trigger', slug: 'death-trigger', aliases: ['death trigger', 'dies trigger', 'when dies', 'on death', 'martyr'], category: 'Graveyard' },
  { label: 'Graveyard Hate', slug: 'graveyard-hate', aliases: ['graveyard hate', 'exile graveyard', 'gy hate', 'grave hate', 'rest in peace'], category: 'Graveyard' },

  // ── Utility ───────────────────────────────────────────────
  { label: 'Flicker', slug: 'flicker', aliases: ['flicker', 'blink', 'exile and return', 'phase out'], category: 'Utility' },
  { label: 'Sac Outlet', slug: 'sacrifice-outlet', aliases: ['sacrifice outlet', 'sac outlet', 'free sac', 'sacrifice'], category: 'Utility' },
  { label: 'Lifegain', slug: 'lifegain', aliases: ['lifegain', 'life gain', 'gain life', 'lifelink', 'life total'], category: 'Utility' },
  { label: 'Anthem', slug: 'anthem', aliases: ['anthem', 'pump', 'buff', '+1/+1 counters', 'power toughness boost'], category: 'Utility' },
  { label: 'Copy', slug: 'copy', aliases: ['copy', 'clone', 'duplicate', 'copy permanent'], category: 'Utility' },
  { label: 'Copy Spell', slug: 'copy-spell', aliases: ['copy spell', 'fork', 'twincast', 'double spell'], category: 'Utility' },
  { label: 'Group Hug', slug: 'group-hug', aliases: ['group hug', 'help everyone', 'give everyone', 'symmetrical benefit'], category: 'Utility' },
]

export const KEYWORD_CATEGORIES = [...new Set(KEYWORDS.map(k => k.category))]

export function parseKeywords(input: string): string[] {
  const lower = input.toLowerCase()
  const found: string[] = []
  for (const kw of KEYWORDS) {
    if (kw.aliases.some(alias => lower.includes(alias))) {
      if (!found.includes(kw.slug)) found.push(kw.slug)
    }
  }
  return found
}
