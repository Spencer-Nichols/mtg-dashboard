#!/usr/bin/env node
// Backfills fake binder price history for chart testing.
// Run:   node scripts/seed-history.js
// Reset: node scripts/seed-history.js --reset

const fs = require('fs')
const path = require('path')

const HISTORY_FILE = path.join(process.env.HOME, 'Projects/scryfall/binder_history.json')
const DAYS = 60

const args = process.argv.slice(2)

if (args.includes('--reset')) {
  const existing = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
  const real = existing.filter(e => !e.seeded)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(real, null, 2))
  console.log(`Reset: removed seeded entries, ${real.length} real entries remain.`)
  process.exit(0)
}

const existing = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))

// Find earliest existing date to seed before it
const dates = existing.map(e => e.date).sort()
const earliest = dates[0] ?? new Date().toISOString().slice(0, 10)
const latestTotal = existing.length > 0
  ? existing.find(e => e.date === dates[dates.length - 1]).total
  : 500

// Generate dates going back DAYS from earliest
function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const startDate = addDays(earliest, -DAYS)

// Random walk: start lower, trend up toward current total with noise
const startTotal = latestTotal * 0.75
const seeded = []
let current = startTotal

for (let i = 0; i < DAYS; i++) {
  const date = addDays(startDate, i)

  // Skip if this date already exists
  if (existing.some(e => e.date === date)) continue

  // Trend slightly upward + random daily noise
  const trend = (latestTotal - startTotal) / DAYS
  const noise = (Math.random() - 0.45) * latestTotal * 0.015 // ~1.5% daily swing
  const spike = Math.random() < 0.08 ? (Math.random() - 0.4) * latestTotal * 0.04 : 0

  current = Math.max(current + trend + noise + spike, latestTotal * 0.5)
  seeded.push({ date, total: parseFloat(current.toFixed(2)), seeded: true })
}

const combined = [...seeded, ...existing].sort((a, b) => a.date.localeCompare(b.date))
fs.writeFileSync(HISTORY_FILE, JSON.stringify(combined, null, 2))
console.log(`Seeded ${seeded.length} fake entries before ${earliest}. Total entries: ${combined.length}`)
console.log(`Range: $${Math.min(...combined.map(e => e.total)).toFixed(2)} – $${Math.max(...combined.map(e => e.total)).toFixed(2)}`)
console.log(`To remove fake data: node scripts/seed-history.js --reset`)
