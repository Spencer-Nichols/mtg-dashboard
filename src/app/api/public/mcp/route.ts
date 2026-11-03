import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { ScryfallRateLimitError, searchCardsChecked } from '@/lib/scryfall'
import { curate, lookupPublicCard } from '@/lib/public-card'

export const dynamic = 'force-dynamic'

const MAX_SEARCH_RESULTS = 8

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }
}

function failure(message: string) {
  return { ...text(message), isError: true }
}

const handler = createMcpHandler(server => {
  server.registerTool(
    'get_card',
    {
      title: 'Get card',
      description: 'Look up one Magic: The Gathering card by name (fuzzy match). Returns exact oracle text, mana cost, type line, power/toughness or loyalty, each face of double-faced cards, set and USD price. If the name is ambiguous, returns a list of candidate names instead.',
      inputSchema: z.object({
        name: z.string().min(1).describe('Card name, e.g. "Sol Ring"'),
        set: z.string().optional().describe('Optional set code to pick a printing, e.g. "trc"'),
      }),
    },
    async ({ name, set }) => {
      console.log('[mcp] get_card', { name, set })
      try {
        const result = await lookupPublicCard(name, set)
        if (!result) return failure(`No card found for "${name}"`)
        return text(result)
      } catch (err) {
        if (err instanceof ScryfallRateLimitError) return failure('Scryfall rate limited the request. Try again in a few seconds.')
        console.error('[mcp] get_card failed', err)
        return failure('Card lookup failed')
      }
    },
  )

  server.registerTool(
    'search_cards',
    {
      title: 'Search cards',
      description: `Search Magic: The Gathering cards with Scryfall search syntax (e.g. "t:creature c:g o:draw cmc<=3"). Returns up to ${MAX_SEARCH_RESULTS} cards, most popular in Commander first, each with full oracle text and price.`,
      inputSchema: z.object({
        query: z.string().min(1).describe('Scryfall search query'),
      }),
    },
    async ({ query }) => {
      console.log('[mcp] search_cards', { query })
      try {
        const cards = await searchCardsChecked(query)
        if (cards.length === 0) return failure(`No cards match "${query}"`)
        return text(cards.slice(0, MAX_SEARCH_RESULTS).map(curate))
      } catch (err) {
        if (err instanceof ScryfallRateLimitError) return failure('Scryfall rate limited the request. Try again in a few seconds.')
        console.error('[mcp] search_cards failed', err)
        return failure('Card search failed')
      }
    },
  )
}, { serverInfo: { name: 'tapntrack-cards', version: '1.0.0' } })

export { handler as GET, handler as POST, handler as DELETE }
