export interface RecentSet {
  name: string
  codes: string[]
}

export const RECENT_SETS: RecentSet[] = [
  { name: 'Secrets of Strixhaven', codes: ['sos', 'soc', 'soa'] },
  { name: 'TMNT',                  codes: ['tmt', 'tmc'] },
  { name: 'Lorwyn Eclipsed',       codes: ['ecl', 'ecc'] },
  { name: 'Final Fantasy',         codes: ['fin', 'fic', 'fca'] },
  { name: 'Tarkir: Dragonstorm',   codes: ['tdm', 'tdc'] },
  { name: 'Aetherdrift',           codes: ['aet', 'drc'] },
  { name: 'Foundations',           codes: ['fdn'] },
  { name: 'Duskmourn',             codes: ['dsk', 'dsc'] },
  { name: 'Bloomburrow',           codes: ['blb', 'blc'] },
  { name: 'Modern Horizons 3',     codes: ['mh3', 'm3c'] },
  { name: 'Lord of the Rings',     codes: ['ltr', 'ltc'] },
]
