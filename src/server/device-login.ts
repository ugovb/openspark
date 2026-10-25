// Sign in a new device with a code (modelled on RFC 8628): the new device asks for a code and shows it
// (`userCode`, e.g. "K7QM-4XPA"), keeps a long secret (`deviceCode`) and polls. A device that is already
// signed in approves the code, after which the poll returns a device token once. Only hashes are stored.
import crypto from 'node:crypto'
import { now } from '../core/db'
import { getKV, setKV } from '../core/settings'
import { t } from '../shared/i18n'
import { type Device, issueDevice } from './auth'

interface Request {
  userHash: string
  deviceHash: string
  name: string
  ip: string | null
  createdAt: number
  expires: number
  status: 'pending' | 'approved' | 'denied'
  userId?: number
}

const KEY = 'server.deviceLogins'
export const LOGIN_TTL = 10 * 60_000
export const POLL_INTERVAL = 2
const MAX_LIVE = 20
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const normUser = (c: string) => String(c || '').replace(/[\s-]/g, '').toUpperCase()
const live = () => getKV<Request[]>(KEY, []).filter((r) => r.expires > now())
const find = (list: Request[], hash: string, field: 'userHash' | 'deviceHash') => list.find((r) => r[field].length === hash.length && crypto.timingSafeEqual(Buffer.from(r[field]), Buffer.from(hash)))

export type PollResult =
  | { status: 'pending' }
  | { status: 'denied' | 'expired' }
  | { status: 'approved'; token: string; device: Omit<Device, 'tokenHash'> }

/** A new device asks to sign in. The code goes on its screen. */
export function startDeviceLogin(name: string, ip: string | null): { userCode: string; deviceCode: string; expires: number; interval: number } {
  const raw = [...crypto.randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  const userCode = `${raw.slice(0, 4)}-${raw.slice(4)}`
  const deviceCode = crypto.randomBytes(24).toString('base64url')
  const expires = now() + LOGIN_TTL
  const list = live()
  list.push({ userHash: sha(normUser(userCode)), deviceHash: sha(deviceCode), name: (name || t('Device')).slice(0, 80), ip, createdAt: now(), expires, status: 'pending' })
  setKV(KEY, list.slice(-MAX_LIVE))
  return { userCode, deviceCode, expires, interval: POLL_INTERVAL }
}

/** What the approving person sees before confirming: which device asked, from where, and when. */
export function lookupDeviceLogin(userCode: string): { name: string; ip: string | null; createdAt: number } | null {
  const r = find(live(), sha(normUser(userCode)), 'userHash')
  return r && r.status === 'pending' ? { name: r.name, ip: r.ip, createdAt: r.createdAt } : null
}

function decide(userCode: string, status: 'approved' | 'denied', userId: number): boolean {
  const list = live()
  const r = find(list, sha(normUser(userCode)), 'userHash')
  if (!r || r.status !== 'pending') return false
  r.status = status
  r.userId = userId
  setKV(KEY, list)
  return true
}

export const approveDeviceLogin = (userCode: string, userId: number) => decide(userCode, 'approved', userId)
export const denyDeviceLogin = (userCode: string, userId: number) => decide(userCode, 'denied', userId)

/** The new device asks whether it was approved. The token is handed out once, then the request is gone. */
export function pollDeviceLogin(deviceCode: string, ip: string | null): PollResult {
  const all = getKV<Request[]>(KEY, [])
  const list = all.filter((r) => r.expires > now())
  const r = find(list, sha(String(deviceCode || '')), 'deviceHash')
  if (!r) {
    if (list.length !== all.length) setKV(KEY, list)
    return { status: 'expired' }
  }
  if (r.status === 'pending') return { status: 'pending' }
  setKV(KEY, list.filter((x) => x !== r))
  if (r.status === 'denied') return { status: 'denied' }
  const d = issueDevice(r.name, ip, r.userId ?? null, 'password')
  return { status: 'approved', token: d.token, device: d.device }
}
