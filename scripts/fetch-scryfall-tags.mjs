import fs from 'fs'
import path from 'path'

const SOURCE_URL = 'https://scryfall.com/docs/tagger-tags'
const OUT_FILE = path.join(process.cwd(), 'src/data/scryfall-tags.json')

const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'mtg-dashboard/1.0', Accept: 'text/html' } })
if (!res.ok) {
  console.error(`Failed to fetch ${SOURCE_URL}: ${res.status}`)
  process.exit(1)
}
const html = await res.text()

const slugs = new Set()
for (const match of html.matchAll(/\/search\?q=oracletag%3A([a-z0-9-]+)/g)) slugs.add(match[1])

if (slugs.size < 1000) {
  console.error(`Only found ${slugs.size} tags; page format may have changed. Not writing ${OUT_FILE}.`)
  process.exit(1)
}

const sorted = [...slugs].sort()
fs.writeFileSync(OUT_FILE, JSON.stringify(sorted) + '\n')
console.log(`Wrote ${sorted.length} oracle tags to ${OUT_FILE}`)
