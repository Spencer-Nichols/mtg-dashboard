import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SealedAlertProduct {
  productName: string
  setName: string
  imageUrl: string | null
  currentPrice: number
  lastNotifiedPrice: number | null
  targetPrice: number | null
  isAtl: boolean
}

function formatPrice(p: number) {
  return `$${p.toFixed(2)}`
}

function buildEmailHtml(products: SealedAlertProduct[]): string {
  const productRows = products.map(p => {
    const badge = p.isAtl
      ? `<span style="background:#92400e;color:#fef3c7;font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;margin-left:8px;">↓ ATL</span>`
      : p.targetPrice != null && p.currentPrice <= p.targetPrice
        ? `<span style="background:#14532d;color:#bbf7d0;font-size:11px;padding:2px 7px;border-radius:4px;font-weight:600;margin-left:8px;">Target hit</span>`
        : ''

    const priceLine = p.lastNotifiedPrice != null
      ? `${formatPrice(p.currentPrice)} <span style="color:#6b7280;font-size:13px;">(was ${formatPrice(p.lastNotifiedPrice)})</span>`
      : formatPrice(p.currentPrice)

    const targetLine = p.targetPrice != null
      ? `<div style="color:#9ca3af;font-size:12px;margin-top:2px;">Your target: ${formatPrice(p.targetPrice)}</div>`
      : ''

    const img = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.productName}" width="60" style="border-radius:4px;display:block;" />`
      : `<div style="width:60px;height:60px;background:#292524;border-radius:4px;"></div>`

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #292524;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:68px;vertical-align:top;padding-right:12px;">${img}</td>
              <td style="vertical-align:top;">
                <div style="color:#e7e5e4;font-size:15px;font-weight:600;line-height:1.3;">
                  ${p.productName}${badge}
                </div>
                <div style="color:#78716c;font-size:12px;margin-top:2px;">${p.setName}</div>
                <div style="color:#fcd34d;font-size:16px;font-weight:700;margin-top:6px;">${priceLine}</div>
                ${targetLine}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TapNTrack Price Alert</title>
</head>
<body style="margin:0;padding:0;background:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#0c0a09;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="background:#1c1917;border-radius:12px 12px 0 0;padding:20px 24px;border-bottom:1px solid #292524;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="color:#fbbf24;font-size:20px;font-weight:700;letter-spacing:-0.5px;">TapNTrack</span>
                    <span style="color:#57534e;font-size:13px;margin-left:8px;">price alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="background:#1c1917;padding:16px 24px 4px;">
              <p style="margin:0;color:#a8a29e;font-size:14px;line-height:1.5;">
                ${products.length === 1
                  ? 'A sealed product on your wishlist hit a price alert.'
                  : `${products.length} sealed products on your wishlist hit price alerts.`}
              </p>
            </td>
          </tr>

          <!-- Products -->
          <tr>
            <td style="background:#1c1917;padding:0 24px 8px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                ${productRows}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#1c1917;padding:20px 24px 24px;">
              <a href="https://tapntrack.app/wishlist"
                style="display:inline-block;background:#d97706;color:#fff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">
                View wishlist →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#171412;border-radius:0 0 12px 12px;padding:16px 24px;">
              <p style="margin:0;color:#44403c;font-size:12px;line-height:1.6;">
                You're receiving this because you enabled sealed price alerts on TapNTrack.<br/>
                <a href="https://tapntrack.app/wishlist" style="color:#78716c;text-decoration:underline;">Manage alerts</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendSealedAlertEmail(to: string, products: SealedAlertProduct[]) {
  if (products.length === 0) return
  const subject = products.length === 1
    ? `Price alert: ${products[0].productName}`
    : `Price alert: ${products.length} sealed products on your wishlist`

  await resend.emails.send({
    from: 'TapNTrack <noreply@tapntrack.app>',
    to,
    subject,
    html: buildEmailHtml(products),
  })
}
