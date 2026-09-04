// Sending email. Resend when RESEND_API_KEY is set; otherwise the message is
// logged and the caller is told, so sign-in can be tested before a mail
// account exists.

const KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Ultreia <onboarding@resend.dev>'

export function emailConfigured(): boolean { return Boolean(KEY) }

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!KEY) { console.log(`[email not configured] to ${to}: ${subject}\n${text}`); return false }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  })
  if (!res.ok) { console.error('resend', res.status, await res.text()); return false }
  return true
}

export function loginEmail(link: string): { subject: string; text: string; html: string } {
  const subject = 'Your Ultreia sign-in link'
  const text = `Buen Camino.\n\nOpen this link to sign in to Ultreia:\n${link}\n\nIt works once and expires in 20 minutes. If you didn't ask for it, ignore this email.`
  const html = `<!doctype html><html><body style="margin:0;background:#E7E9E6;font-family:Georgia,'Times New Roman',serif;color:#1B2430">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:24px;letter-spacing:.02em;text-transform:uppercase;color:#8A6206">Ultreia</div>
    <p style="font-size:18px;line-height:1.5;margin:24px 0 0">Buen Camino.</p>
    <p style="font-size:16px;line-height:1.6;color:#59646F;margin:12px 0 24px">Open this to sign in. It works once, and expires in twenty minutes.</p>
    <a href="${link}" style="display:inline-block;background:#E09B0B;color:#1B2430;text-decoration:none;padding:14px 24px;border-radius:24px;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Sign in</a>
    <p style="font-size:13px;line-height:1.6;color:#8A939B;margin:28px 0 0">If you didn't ask for this, ignore it — nothing happens.</p>
  </div></body></html>`
  return { subject, text, html }
}
