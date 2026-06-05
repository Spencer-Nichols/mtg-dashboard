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
  { label: 'Impulse Draw', slug: 'impulse', aliases: ['impulse draw', 'exile then play', 'exile top card and play'], category: 'Card Advantage' },
  { label: 'Surveil', slug: 'surveil', aliases: ['surveil', 'look at top then graveyard'], category: 'Card Advantage' },

  // ── Ramp ─────────────────────────────────────────────────
  { label: 'Ramp', slug: 'ramp', aliases: ['ramp', 'mana ramp', 'acceleration', 'fast mana'], category: 'Ramp' },
  { label: 'Mana Rock', slug: 'mana-rock', aliases: ['mana rock', 'rock', 'rocks', 'artifact ramp'], category: 'Ramp' },
  { label: 'Mana Dork', slug: 'mana-dork', aliases: ['mana dork', 'dork', 'creature ramp', 'elf ramp'], category: 'Ramp' },
  { label: 'Land Ramp', slug: 'land-ramp', aliases: ['land ramp', 'land search', 'fetch land', 'land tutoring'], category: 'Ramp' },
  { label: 'Mana Doubler', slug: 'mana-doubler', aliases: ['mana doubler', 'double mana', 'mana multiplier'], category: 'Ramp' },
  { label: 'Mana Sink', slug: 'mana-sink', aliases: ['mana sink', 'mana outlet', 'dump mana', 'spend mana'], category: 'Ramp' },
  { label: 'Cost Reducer', slug: 'cost-reduction', aliases: ['cost reducer', 'cost reduction', 'reduce mana cost', 'affinity', 'make cheaper'], category: 'Ramp' },
  { label: 'Treasure', slug: 'treasure', aliases: ['treasure', 'treasure token', 'make treasure'], category: 'Ramp' },

  // ── Removal ───────────────────────────────────────────────
  { label: 'Removal', slug: 'removal', aliases: ['removal', 'kill', 'destroy', 'exile target'], category: 'Removal' },
  { label: 'Board Wipe', slug: 'board-wipe', aliases: ['board wipe', 'wrath', 'sweeper', 'boardwipe', 'mass removal'], category: 'Removal' },
  { label: 'Bounce', slug: 'bounce', aliases: ['bounce', 'return to hand', 'unsummon', 'tempo'], category: 'Removal' },
  { label: 'Land Destruction', slug: 'land-destruction', aliases: ['land destruction', 'destroy land', 'strip mine', 'blow up land'], category: 'Removal' },
  { label: 'Theft', slug: 'theft', aliases: ['theft', 'steal', 'gain control', 'take control'], category: 'Removal' },

  // ── Control ───────────────────────────────────────────────
  { label: 'Counterspell', slug: 'counterspell', aliases: ['counter', 'counterspell', 'counter spell', 'negate', 'deny'], category: 'Control' },
  { label: 'Tutor', slug: 'tutor', aliases: ['tutor', 'search library', 'fetch', 'find card'], category: 'Control' },
  { label: 'Tax', slug: 'tax', aliases: ['tax', 'cost more', 'stax', 'slow down', 'punish'], category: 'Control' },
  { label: 'Discard', slug: 'discard', aliases: ['discard', 'hand disruption', 'strip hand', 'thoughtseize'], category: 'Control' },
  { label: 'Protection', slug: 'protection', aliases: ['protection', 'hexproof', 'shroud', 'ward', 'indestructible', 'protect'], category: 'Control' },
  { label: 'Pillowfort', slug: 'pillowfort', aliases: ['pillowfort', 'pillow fort', "can't attack me", 'deflect', 'prevent combat'], category: 'Control' },
  { label: 'Fog', slug: 'fog', aliases: ['fog', 'prevent all combat damage', 'safe from combat'], category: 'Control' },
  { label: 'Extra Turn', slug: 'extra-turn', aliases: ['extra turn', 'take another turn', 'time walk', 'extra turns'], category: 'Control' },
  { label: 'Hatebears', slug: 'hatebears', aliases: ['hatebear', 'hatebears', 'hate bear', 'stax creature', 'disruption creature'], category: 'Control' },
  { label: 'Stax', slug: 'stax', aliases: ['stax', 'prison', 'lock out', 'slow everyone'], category: 'Control' },

  // ── Graveyard ────────────────────────────────────────────
  { label: 'Reanimate', slug: 'reanimate', aliases: ['reanimate', 'reanimation', 'resurrect', 'return from graveyard'], category: 'Graveyard' },
  { label: 'Self Mill', slug: 'self-mill', aliases: ['self mill', 'fill graveyard', 'mill myself', 'dredge', 'entomb'], category: 'Graveyard' },
  { label: 'Death Trigger', slug: 'death-trigger', aliases: ['death trigger', 'dies trigger', 'when dies', 'on death'], category: 'Graveyard' },
  { label: 'Graveyard Hate', slug: 'graveyard-hate', aliases: ['graveyard hate', 'exile graveyard', 'gy hate', 'rest in peace'], category: 'Graveyard' },
  { label: 'Flashback', slug: 'flashback', aliases: ['flashback', 'cast from graveyard', 'graveyard cast'], category: 'Graveyard' },
  { label: 'Unearth', slug: 'unearth', aliases: ['unearth', 'return to battlefield temporarily', 'temporary reanimate'], category: 'Graveyard' },

  // ── Tokens ───────────────────────────────────────────────
  { label: 'Token Generator', slug: 'token-generation', aliases: ['token generator', 'make tokens', 'create tokens', 'token producer'], category: 'Tokens' },
  { label: 'Aristocrats', slug: 'aristocrats', aliases: ['aristocrats', 'sacrifice payoff', 'sac payoff', 'when creature dies'], category: 'Tokens' },
  { label: 'Token Doubler', slug: 'token-doubler', aliases: ['token doubler', 'double tokens', 'double the tokens', 'populate'], category: 'Tokens' },
  { label: 'Populate', slug: 'populate', aliases: ['populate', 'copy token', 'copy a token you control'], category: 'Tokens' },
  { label: 'Go Wide', slug: 'go-wide', aliases: ['go wide', 'wide board', 'attack with many', 'swarm'], category: 'Tokens' },

  // ── Counters ─────────────────────────────────────────────
  { label: '+1/+1 Counters', slug: 'plus-one-plus-one-counters', aliases: ['+1/+1', 'counter synergy', 'counters matter', 'add counters'], category: 'Counters' },
  { label: 'Proliferate', slug: 'proliferate', aliases: ['proliferate', 'add counter to each', 'spread counters'], category: 'Counters' },
  { label: 'Modular', slug: 'modular', aliases: ['modular', 'move counters', 'transfer counters'], category: 'Counters' },
  { label: 'Energy', slug: 'energy', aliases: ['energy', 'energy counter', 'pay energy'], category: 'Counters' },
  { label: 'Poison / Infect', slug: 'infect', aliases: ['infect', 'poison', 'poison counter', 'proliferate poison'], category: 'Counters' },

  // ── Strategies ───────────────────────────────────────────
  { label: 'Spellslinger', slug: 'spellslinger', aliases: ['spellslinger', 'spell slinger', 'instants and sorceries matter', 'cast spells matter'], category: 'Strategies' },
  { label: 'Voltron', slug: 'voltron', aliases: ['voltron', 'commander damage', 'suit up', 'equip commander', 'aura commander'], category: 'Strategies' },
  { label: 'Landfall', slug: 'landfall', aliases: ['landfall', 'land enters', 'land drop', 'when land enters'], category: 'Strategies' },
  { label: 'Enchantress', slug: 'enchantress', aliases: ['enchantress', 'enchantment payoff', 'enchantments matter', 'when enchantment enters'], category: 'Strategies' },
  { label: 'Equipment', slug: 'equipment', aliases: ['equipment', 'equipment matters', 'equip', 'equipment payoff'], category: 'Strategies' },
  { label: 'Storm', slug: 'storm', aliases: ['storm', 'storm count', 'spells this turn', 'cast storm'], category: 'Strategies' },
  { label: 'Tribal', slug: 'tribal', aliases: ['tribal', 'creature type matters', 'lord effect', 'same creature type'], category: 'Strategies' },
  { label: 'Graveyard Matters', slug: 'graveyard-matters', aliases: ['graveyard matters', 'cards in graveyard', 'number of creatures in gy'], category: 'Strategies' },
  { label: 'Keyword Soup', slug: 'keyword-counters', aliases: ['keyword counters', 'keyword soup', 'flying vigilance trample'], category: 'Strategies' },
  { label: 'Theft / Borrow', slug: 'act-of-treason', aliases: ['act of treason', 'borrow', 'temporary steal', 'gain control until end of turn'], category: 'Strategies' },
  { label: 'Cascade', slug: 'cascade', aliases: ['cascade', 'cast cascade', 'free spell'], category: 'Strategies' },
  { label: 'Vehicles', slug: 'vehicles', aliases: ['vehicle', 'vehicles', 'crew', 'crew cost'], category: 'Strategies' },

  // ── Utility ───────────────────────────────────────────────
  { label: 'Flicker', slug: 'flicker', aliases: ['flicker', 'blink', 'exile and return', 'phase out'], category: 'Utility' },
  { label: 'Sac Outlet', slug: 'sacrifice-outlet', aliases: ['sacrifice outlet', 'sac outlet', 'free sac', 'sacrifice'], category: 'Utility' },
  { label: 'Lifegain', slug: 'lifegain', aliases: ['lifegain', 'life gain', 'gain life', 'lifelink', 'life total'], category: 'Utility' },
  { label: 'Anthem', slug: 'anthem', aliases: ['anthem', 'pump', 'buff', 'power toughness boost'], category: 'Utility' },
  { label: 'Copy', slug: 'copy', aliases: ['copy', 'clone', 'duplicate', 'copy permanent'], category: 'Utility' },
  { label: 'Copy Spell', slug: 'copy-spell', aliases: ['copy spell', 'fork', 'twincast', 'double spell'], category: 'Utility' },
  { label: 'Group Hug', slug: 'group-hug', aliases: ['group hug', 'help everyone', 'give everyone', 'symmetrical benefit'], category: 'Utility' },
  { label: 'Haste Enabler', slug: 'haste', aliases: ['haste enabler', 'give haste', 'attack right away'], category: 'Utility' },
  { label: 'Evasion', slug: 'evasion', aliases: ['evasion', 'unblockable', 'menace', 'fear', 'intimidate', 'can\'t be blocked'], category: 'Utility' },
  { label: 'Card Selection', slug: 'card-selection', aliases: ['card selection', 'arrange top', 'bottom of library', 'look at top'], category: 'Utility' },
  { label: 'Recursion', slug: 'recursion', aliases: ['recursion', 'return to hand from graveyard', 'rescue from yard'], category: 'Utility' },
  { label: 'Phasing', slug: 'phasing', aliases: ['phasing', 'phase', 'phase out', 'phases out'], category: 'Utility' },
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
