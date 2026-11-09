import { zipSync } from 'fflate'

// tcgplaytest zip import: <Deck>/FRONT/001.jpg pairs with <Deck>/BACK/001.jpg by number,
// and the FRONT and BACK counts must match.
const BLEED_RATIO = 0.125 / 2.5
const JPEG_QUALITY = 0.95
const CONCURRENCY = 4
const PROXY_BACK_URL = '/default-proxy-back-bleed.jpg'

export interface ProxySlot {
  front: string
  back: string | null
}

async function fetchBytes(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image download failed (${res.status})`)
  return res.blob()
}

// Puts the card on black with a 1/8" bleed on every side, filling Scryfall's transparent corners.
async function withBleed(url: string): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(await fetchBytes(url))
  const pad = Math.round(bitmap.width * BLEED_RATIO)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width + pad * 2
  canvas.height = bitmap.height + pad * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, pad, pad)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error('Could not encode a card image')
  return new Uint8Array(await blob.arrayBuffer())
}

function safeFolderName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Proxies'
}

export async function buildProxyZip(deckName: string, slots: ProxySlot[], onProgress: (done: number, total: number) => void) {
  const folder = safeFolderName(deckName)
  const proxyBack = new Uint8Array(await (await fetchBytes(PROXY_BACK_URL)).arrayBuffer())

  const uniqueUrls = [...new Set(slots.flatMap(s => [s.front, s.back]).filter((u): u is string => !!u))]
  const images = new Map<string, Uint8Array>()
  let done = 0
  onProgress(0, uniqueUrls.length)

  let next = 0
  async function worker() {
    while (next < uniqueUrls.length) {
      const url = uniqueUrls[next++]
      images.set(url, await withBleed(url))
      onProgress(++done, uniqueUrls.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, uniqueUrls.length) }, worker))

  const files: Record<string, Uint8Array> = {}
  slots.forEach((slot, i) => {
    const number = String(i + 1).padStart(3, '0')
    files[`${folder}/FRONT/${number}.jpg`] = images.get(slot.front)!
    files[`${folder}/BACK/${number}.jpg`] = slot.back ? images.get(slot.back)! : proxyBack
  })

  const zipped = zipSync(files, { level: 0 })
  const blobUrl = URL.createObjectURL(new Blob([zipped as BlobPart], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `${folder}.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  return { fileName: `${folder}.zip`, cardCount: slots.length }
}
