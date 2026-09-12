// The scheduled function and this app share an environment, so they can
// share a proof without a new secret: an HMAC of today's date under the
// VAPID private key. Nothing to paste into Netlify, nothing to leak.
export async function cronSignature(day: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(day))
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
}
export const today = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
