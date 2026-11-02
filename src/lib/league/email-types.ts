export const LEAGUE_EMAIL_TYPES = {
  gameScheduled: 'A game date is set or changed',
  tradeOffer: 'Someone sends you a trade offer',
  tradeResponse: 'Your trade offer is accepted or declined',
  swap: 'The Underdog Swap takes one of your cards',
  seasonEnded: 'The season ends',
  addedToLeague: 'You get a seat in a league',
} as const

export type LeagueEmailType = keyof typeof LEAGUE_EMAIL_TYPES
