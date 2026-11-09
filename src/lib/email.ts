import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface AlertItem {
  name: string
  setName: string
  imageUrl: string | null
  currentPrice: number
  lastNotifiedPrice: number | null
  targetPrice: number | null
  isAtl: boolean
}

type AlertKind = 'sealed' | 'singles'

const NOUN: Record<AlertKind, { one: string; many: string }> = {
  sealed: { one: 'sealed product', many: 'sealed products' },
  singles: { one: 'card', many: 'cards' },
}

function formatPrice(p: number) {
  return `$${p.toFixed(2)}`
}

function buildEmailHtml(products: AlertItem[], kind: AlertKind): string {
  const noun = NOUN[kind]
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
      ? `<img src="${p.imageUrl}" alt="${p.name}" width="60" style="border-radius:4px;display:block;" />`
      : `<div style="width:60px;height:60px;background:#292524;border-radius:4px;"></div>`

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #292524;vertical-align:top;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:68px;vertical-align:top;padding-right:12px;">${img}</td>
              <td style="vertical-align:top;">
                <div style="color:#e7e5e4;font-size:15px;font-weight:600;line-height:1.3;">
                  ${p.name}${badge}
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
                  ? `A ${noun.one} on your wishlist hit a price alert.`
                  : `${products.length} ${noun.many} on your wishlist hit price alerts.`}
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
                You're receiving this because you enabled ${kind} price alerts on TapNTrack.<br/>
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

export async function sendAlertEmail(to: string, products: AlertItem[], kind: AlertKind) {
  if (products.length === 0) return
  const noun = NOUN[kind]
  const subject = products.length === 1
    ? `Price alert: ${products[0].name}`
    : `Price alert: ${products.length} ${noun.many} on your wishlist`

  await resend.emails.send({
    from: 'TapNTrack <noreply@tapntrack.app>',
    to,
    subject,
    html: buildEmailHtml(products, kind),
  })
}

export interface LeagueEmail {
  heading: string
  lines: string[]
  ctaLabel: string
  ctaPath: string
}

interface EmailFrame {
  eyebrow: string
  footer: string | null
}

const LEAGUE_FRAME: EmailFrame = { eyebrow: 'TapNTrack League', footer: 'You can turn off league emails on the league page.' }

function leagueEmailHtml(email: LeagueEmail, frame: EmailFrame = LEAGUE_FRAME) {
  const lines = email.lines.map(l => `<p style="margin:0 0 10px;color:#d6d3d1;font-size:15px;line-height:1.5;">${l}</p>`).join('')
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a09;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1c1917;border:1px solid #292524;border-radius:12px;">
        <tr><td style="padding:24px 24px 8px;">
          <p style="margin:0 0 6px;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${frame.eyebrow}</p>
          <h1 style="margin:0 0 16px;color:#f5f5f4;font-size:20px;">${email.heading}</h1>
          ${lines}
        </td></tr>
        <tr><td style="padding:8px 24px 24px;">
          <a href="https://tapntrack.app${email.ctaPath}" style="display:inline-block;background:#451a03;border:1px solid #b45309;color:#fde68a;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">${email.ctaLabel}</a>
        </td></tr>
        ${frame.footer ? `<tr><td style="padding:0 24px 20px;color:#78716c;font-size:12px;">${frame.footer}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendLeagueEmail(to: string, subject: string, email: LeagueEmail) {
  await resend.emails.send({
    from: 'TapNTrack <noreply@tapntrack.app>',
    to,
    subject,
    html: leagueEmailHtml(email),
  })
}

export async function sendProxyAccessEmail(to: string) {
  await resend.emails.send({
    from: 'TapNTrack <noreply@tapntrack.app>',
    to,
    subject: 'You have access to the TapNTrack Proxy builder',
    html: leagueEmailHtml({
      heading: 'The Proxy builder is unlocked',
      lines: [
        'You can now turn a decklist, or just a few cards, into a print-ready zip for tcgplaytest using the exact printing of every card.',
        'Real card art only: each card is the official Scryfall printing you pick, with a proxy back that is clearly not a real Magic card.',
        'Find it under <strong>Proxies</strong> in the menu.',
      ],
      ctaLabel: 'Open Proxies',
      ctaPath: '/proxies',
    }, { eyebrow: 'TapNTrack Proxies', footer: null }),
  })
}
