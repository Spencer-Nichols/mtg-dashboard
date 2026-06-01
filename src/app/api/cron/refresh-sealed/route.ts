import { NextRequest, NextResponse } from 'next/server'
import { refreshSealedPrices } from '@/lib/sealed-price-refresh'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const result = await refreshSealedPrices()
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)

  return NextResponse.json({ ok: true, elapsed: `${elapsed}s`, ...result })
}
