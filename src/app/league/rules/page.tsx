import Link from 'next/link'
import { leagueContext } from '@/lib/league/store'
import { LeagueError } from '@/lib/league/types'

export const dynamic = 'force-dynamic'

const PLACES = ['1st', '2nd', '3rd', '4th']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-stone-900 border border-stone-800 rounded-xl p-5 flex flex-col gap-3">
      <h2 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2 text-sm text-stone-300 list-disc pl-5">{children}</ul>
    </section>
  )
}

export default async function LeagueRulesPage() {
  let settings
  try {
    settings = (await leagueContext()).state.settings
  } catch (err) {
    if (err instanceof LeagueError) return <p className="text-red-400 text-sm">{err.message}</p>
    throw err
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex flex-col gap-1">
        <Link href="/league" className="text-sm text-stone-500 hover:text-stone-300">← League</Link>
        <h1 className="text-2xl font-bold text-stone-100">{settings.name} rules</h1>
        <p className="text-sm text-stone-400">4 players · {settings.totalGames} games · Star Trek precons</p>
      </div>

      <Section title="Format">
        <li>Each week the four players play one 4-player free-for-all game with their Star Trek decks.</li>
        <li><strong className="text-stone-100">Bye week:</strong> once per person per season, you can call a bye and no league game happens that week. After that, you have to miss a week instead.</li>
        <li><strong className="text-stone-100">Missed week:</strong> {settings.missedPoints} point and no weekly pack. The pack is added to the end-of-season prizes.</li>
      </Section>

      <Section title="Packs">
        <li><strong className="text-stone-100">Opening night:</strong> each player opens {settings.openingPacks} packs. Pulled cards can be used to upgrade decks.</li>
        <li><strong className="text-stone-100">Weekly:</strong> each player opens 1 pack per game played.</li>
        <li><strong className="text-stone-100">Catch-up reserve:</strong> {settings.reservePacks} packs. Finish last two games in a row and you earn 1 reserve pack, opened that night (one per player). Unused reserve packs are opened together or split on finale night.</li>
      </Section>

      <section className="bg-stone-900 border border-stone-800 rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs text-stone-400 uppercase tracking-widest font-semibold">Scoring (per game)</h2>
        <div className="grid grid-cols-4 gap-2 max-w-sm">
          {settings.finishPoints.map((pts, i) => (
            <div key={i} className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-stone-500">{PLACES[i]}</p>
              <p className="text-lg font-bold font-mono text-amber-200">{pts}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm text-stone-300 list-disc pl-5">
          <li><strong className="text-stone-100">First Blood:</strong> +{settings.firstBloodBonus} point for eliminating the first player in a game.</li>
          <li><strong className="text-stone-100">Tiebreakers:</strong> most 1st-place finishes, then most 2nds, then head-to-head.</li>
          <li>Players knocked out at the same time share the higher place.</li>
        </ul>
      </section>

      <Section title="Streaks and catch-up">
        <li><strong className="text-stone-100">Underdog Boost:</strong> after 3 straight 4th-place finishes, start your next game with {settings.boostLife} life instead of {settings.startingLife}. It ends once you finish 3rd or better.</li>
        <li><strong className="text-stone-100">Bounty:</strong> after 2 straight wins, anyone who eliminates you earns +{settings.bountyBonus} bonus point. The bounty ends when you fail to win a game.</li>
        <li><strong className="text-stone-100">Underdog Swap:</strong> the player in last place may, once per week, take 1 card from each opponent&apos;s unused pulls (pulled cards not in a deck). In exchange, they give back a card of the same rarity from their own pulls. Opponents can&apos;t refuse. Original precon cards are protected.</li>
      </Section>

      <Section title="Trading">
        <li>Trades happen before games, and both players must agree.</li>
        <li>Each player may make up to {settings.tradesPerPairPerWeek} trades per week with each other player.</li>
        <li>The Underdog Swap doesn&apos;t count toward the trade limit.</li>
      </Section>

      <Section title="Deck changes">
        <li>Decks may be upgraded only with cards from league packs and trades.</li>
        <li>Decks must stay legal and always 100 cards.</li>
        <li>Changes happen between games, and each week&apos;s changes are announced before play.</li>
      </Section>

      <Section title="Season prizes (by total points)">
        {settings.prizePacks.map((packs, i) => (
          <li key={i}><strong className="text-stone-100">{PLACES[i]}:</strong> {packs} packs{i === 0 ? ' and the collector booster' : ''}</li>
        ))}
      </Section>
    </div>
  )
}
