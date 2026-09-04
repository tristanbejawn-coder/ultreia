// A follower's name, given once and remembered on this device.
const KEY = 'ultreia:name'
export function getName(): string | null { try { return localStorage.getItem(KEY) } catch { return null } }
export function setName(n: string) { try { localStorage.setItem(KEY, n) } catch { /* private mode */ } }
