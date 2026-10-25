// Setup code of a fresh home server: proof that the person at the browser controls the server, without a
// terminal. It comes from OPENMAIL_SETUP_CODE (set in the compose file) or is generated once and printed
// in the server log. It works until the owner account exists, then it disappears.
import crypto from 'node:crypto'
import { getKV, setKV } from '../core/settings'
import { env } from '../shared/env'
import { log } from '../core/events'
import { hasOwner } from './users'

const KEY = 'server.setupCode'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const norm = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()
const valid = (s: string | undefined): s is string => !!s && /^[A-Za-z0-9-]{8,64}$/.test(s) && norm(s).length >= 8

let warned = false

/** The code to show on the server (null once an account exists). */
export function getSetupCode(): string | null {
  if (hasOwner()) return null
  const fromEnv = env('SETUP_CODE')
  if (valid(fromEnv)) return fromEnv
  if (fromEnv && !warned) {
    warned = true
    log('server', 'OPENMAIL_SETUP_CODE ignored: use 8 to 64 letters, digits or hyphens, no spaces')
  }
  const stored = getKV<string | null>(KEY, null)
  if (stored) return stored
  const raw = [...crypto.randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  const code = `${raw.slice(0, 4)}-${raw.slice(4)}`
  setKV(KEY, code)
  return code
}

/** True when `input` is the current setup code. Case, spaces and hyphens do not matter. */
export function redeemSetupCode(input: string): boolean {
  const code = getSetupCode()
  if (!code) return false
  const a = Buffer.from(sha(norm(code)))
  const b = Buffer.from(sha(norm(String(input || ''))))
  return crypto.timingSafeEqual(a, b)
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
