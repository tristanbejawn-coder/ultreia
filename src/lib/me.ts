// A follower's name, given once and remembered on this device.
const KEY = 'ultreia:name'
export function getName(): string | null { try { return localStorage.getItem(KEY) } catch { return null } }
export function setName(n: string) { try { localStorage.setItem(KEY, n) } catch { /* private mode */ } }

// And where they write from, for the postmark on their postcards.
const PLACE = 'ultreia:place'
export function getPlace(): string | null { try { return localStorage.getItem(PLACE) } catch { return null } }
export function setPlace(n: string) { try { if (n) localStorage.setItem(PLACE, n); else localStorage.removeItem(PLACE) } catch { /* private mode */ } }
