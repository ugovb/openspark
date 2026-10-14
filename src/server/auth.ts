// Device pairing for the home server: a short one-time code (shown by `octo server pair`)
// is exchanged for a long per-device token. Only SHA-256 hashes are stored.
import crypto from 'node:crypto'
import { now } from '../core/db'
import { getKV, setKV } from '../core/settings'
import { t } from '../shared/i18n'
import { hasOwner } from './users'

export interface Device {
  id: string
  name: string
  tokenHash: string
  createdAt: number
  lastSeen: number | null
  lastIp: string | null
  /** owner account the device signed in with (null = paired with a code before accounts existed) */
  userId?: number | null
  method?: 'pairing' | 'password'
}

interface Pairing {
  codeHash: string
  name: string | null
  expires: number
}

const DEVICES = 'server.devices'
const PAIRINGS = 'server.pairings'
const ALLOW_PAIRING = 'server.allowPairing'
const PAIR_TTL = 15 * 60_000
const MAX_LIVE_CODES = 5 // repeated clicks cannot grow the store: the oldest code is dropped
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export function listDevices(): Omit<Device, 'tokenHash'>[] {
  return getKV<Device[]>(DEVICES, []).map(({ tokenHash: _t, ...d }) => d)
}

/** Create a one-time pairing code valid for 15 minutes, e.g. "K7QM-4XPA". */
export function createPairingCode(name?: string): { code: string; expires: number } {
  const bytes = crypto.randomBytes(8)
  const raw = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`
  const expires = now() + PAIR_TTL
  const list = getKV<Pairing[]>(PAIRINGS, []).filter((p) => p.expires > now())
  list.push({ codeHash: sha(code.replace('-', '').toUpperCase()), name: name || null, expires })
  setKV(PAIRINGS, list.slice(-MAX_LIVE_CODES))
  return { code, expires }
}

/** Exchange a pairing code for a device token. Returns null when the code is wrong or expired. */
export function redeemPairingCode(code: string, deviceName: string, ip: string | null): { token: string; device: Omit<Device, 'tokenHash'> } | null {
  const h = sha(code.replace(/[\s-]/g, '').toUpperCase())
  const list = getKV<Pairing[]>(PAIRINGS, []).filter((p) => p.expires > now())
  const hit = list.find((p) => crypto.timingSafeEqual(Buffer.from(p.codeHash), Buffer.from(h)))
  if (!hit) {
    setKV(PAIRINGS, list)
    return null
  }
  setKV(PAIRINGS, list.filter((p) => p !== hit))
  return issueDevice(hit.name || deviceName, ip, null, 'pairing')
}

/** Creates a device and its long-lived token (only the hash is stored). */
export function issueDevice(name: string, ip: string | null, userId: number | null, method: 'pairing' | 'password'): { token: string; device: Omit<Device, 'tokenHash'> } {
  const token = `octo_${crypto.randomBytes(32).toString('base64url')}`
  const device: Device = {
    id: crypto.randomBytes(6).toString('hex'),
    name: (name || t('Device')).slice(0, 80),
    tokenHash: sha(token),
    createdAt: now(),
    lastSeen: now(),
    lastIp: ip,
    userId,
    method,
  }
  setKV(DEVICES, [...getKV<Device[]>(DEVICES, []), device])
  const { tokenHash: _t, ...pub } = device
  return { token, device: pub }
}

/** Devices paired with a code before the account existed belong to the same single owner: attach them to it. */
export function linkLegacyDevices(userId: number): void {
  setKV(DEVICES, getKV<Device[]>(DEVICES, []).map((d) => (d.userId ? d : { ...d, userId, method: 'pairing' as const })))
}

export function revokeAllDevices(): number {
  const n = getKV<Device[]>(DEVICES, []).length
  setKV(DEVICES, [])
  seenWrites = new Map()
  return n
}

/** Pairing codes work until the owner account exists; after that only when switched on in "My account". */
export function pairingAllowed(): boolean {
  return !hasOwner() || getKV<boolean>(ALLOW_PAIRING, false)
}

export function setPairingAllowed(allow: boolean): void {
  setKV(ALLOW_PAIRING, allow)
}

// --- short-lived tickets between the password step and the second-factor step ---
const tickets = new Map<string, { userId: number; expires: number; tries: number; name: string }>()
const TICKET_TTL = 5 * 60_000
const TICKET_TRIES = 5

export function createTicket(userId: number, deviceName: string): string {
  for (const [k, v] of tickets) if (v.expires < now()) tickets.delete(k)
  const id = crypto.randomBytes(24).toString('base64url')
  tickets.set(id, { userId, expires: now() + TICKET_TTL, tries: 0, name: deviceName })
  return id
}

/** Looks a ticket up and counts one try; after 5 wrong codes it is gone. */
export function useTicket(id: string): { userId: number; name: string } | null {
  const k = tickets.get(id)
  if (!k || k.expires < now()) {
    tickets.delete(id)
    return null
  }
  if (++k.tries > TICKET_TRIES) {
    tickets.delete(id)
    return null
  }
  return { userId: k.userId, name: k.name }
}

export function closeTicket(id: string): void {
  tickets.delete(id)
}

let seenWrites = new Map<string, number>()

/** Check a bearer token; updates "last seen" at most once a minute. */
export function authenticate(token: string | null | undefined, ip: string | null): Omit<Device, 'tokenHash'> | null {
  if (!token || !token.startsWith('octo_')) return null
  const h = sha(token)
  const devices = getKV<Device[]>(DEVICES, [])
  const d = devices.find((x) => x.tokenHash.length === h.length && crypto.timingSafeEqual(Buffer.from(x.tokenHash), Buffer.from(h)))
  if (!d) return null
  const last = seenWrites.get(d.id) || 0
  if (now() - last > 60_000) {
    seenWrites.set(d.id, now())
    d.lastSeen = now()
    d.lastIp = ip
    setKV(DEVICES, devices)
  }
  const { tokenHash: _t, ...pub } = d
  return pub
}

export function revokeDevice(id: string): boolean {
  const devices = getKV<Device[]>(DEVICES, [])
  const next = devices.filter((d) => d.id !== id)
  setKV(DEVICES, next)
  seenWrites = new Map([...seenWrites].filter(([k]) => k !== id))
  return next.length !== devices.length
}

// --- brute-force protection for pairing / login ---
const failures = new Map<string, number[]>()

export function tooManyFailures(ip: string): boolean {
  const recent = (failures.get(ip) || []).filter((t) => now() - t < 10 * 60_000)
  failures.set(ip, recent)
  return recent.length >= 10
}

export function noteFailure(ip: string): void {
  const arr = failures.get(ip) || []
  arr.push(now())
  failures.set(ip, arr)
}
