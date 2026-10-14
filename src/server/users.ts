// Owner account of the home server: email + password (scrypt) and an optional TOTP second factor
// (RFC 6238) with one-time recovery codes. Everything uses node:crypto, no extra dependency.
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { all, get, now, run } from '../core/db'
import { getSecret, setSecret, totpKeyName } from '../core/secrets'
import { t } from '../shared/i18n'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>

export interface User {
  id: number
  email: string
  totpEnabled: boolean
  recoveryLeft: number
  createdAt: number
  passwordChangedAt: number
}

interface Row {
  id: number
  email: string
  password_hash: string
  totp_secret: string | null
  totp_enabled: number
  totp_last_step: number
  recovery_hashes: string
  failed_count: number
  locked_until: number | null
  created_at: number
  password_changed_at: number
}

export const MAX_FAILURES = 10
export const LOCK_MS = 15 * 60_000
export const MIN_PASSWORD = 10
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const normEmail = (e: string) => e.trim().toLowerCase()

// ---------- passwords ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, 32, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const [alg, N, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const want = Buffer.from(key, 'base64')
  const got = await scrypt(password, Buffer.from(salt, 'base64'), want.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem })
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'azertyuiop', 'motdepasse',
  'motdepasse1', 'iloveyou12', 'welcome123', 'administrator', 'letmein123', 'azerty1234', 'qwerty1234', 'changeme123',
])

/** Returns a message when the password is too weak, null when acceptable. */
export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < MIN_PASSWORD) return t('Use at least {n} characters.', { n: MIN_PASSWORD })
  if (password.length > 200) return t('That password is too long.')
  if (COMMON.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) return t('That password is too easy to guess.')
  const local = normEmail(email).split('@')[0]
  if (local.length >= 4 && password.toLowerCase().includes(local)) return t('The password must not contain your email address.')
  return null
}

export function emailProblem(email: string): string | null {
  return /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 200 ? null : t('Enter a valid email address.')
}

// ---------- TOTP (RFC 6238) ----------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s.toUpperCase().replace(/[=\s]/g, '')) {
    const i = B32.indexOf(ch)
    if (i < 0) throw new Error('bad base32')
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export const TOTP_STEP = 30

/** The 6-digit code for a 30-second step (HMAC-SHA1, RFC 4226 truncation). */
export function totpAt(secretB32: string, step: number, digits = 6): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = crypto.createHmac('sha1', base32Decode(secretB32)).update(msg).digest()
  const o = h[h.length - 1] & 15
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** Accepts the current step and one before/after (clock drift). Returns the matching step, or null. A step already used is refused. */
export function verifyTotp(secretB32: string, code: string, lastStep = 0, at = now()): number | null {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const cur = Math.floor(at / 1000 / TOTP_STEP)
  for (const step of [cur, cur - 1, cur + 1]) {
    if (step <= lastStep) continue
    const want = Buffer.from(totpAt(secretB32, step))
    if (crypto.timingSafeEqual(want, Buffer.from(clean))) return step
  }
  return null
}

export function otpauthUri(email: string, secretB32: string): string {
  return `otpauth://totp/OpenSpark:${encodeURIComponent(email)}?secret=${secretB32}&issuer=OpenSpark&algorithm=SHA1&digits=6&period=${TOTP_STEP}`
}

// ---------- the TOTP secret is encrypted at rest (key kept in the secret store) ----------

function totpKey(): Buffer {
  let hex = getSecret(totpKeyName)
  if (!hex) {
    hex = crypto.randomBytes(32).toString('hex')
    setSecret(totpKeyName, hex)
  }
  return Buffer.from(hex, 'hex')
}

export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', totpKey(), iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64')).join('.')
}

export function openSecret(sealed: string): string {
  const [iv, tag, ct] = sealed.split('.').map((x) => Buffer.from(x, 'base64'))
  const d = crypto.createDecipheriv('aes-256-gcm', totpKey(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
}

// ---------- accounts ----------

const toUser = (r: Row): User => ({
  id: r.id,
  email: r.email,
  totpEnabled: !!r.totp_enabled,
  recoveryLeft: (JSON.parse(r.recovery_hashes) as string[]).length,
  createdAt: r.created_at,
  passwordChangedAt: r.password_changed_at,
})

const row = (id: number) => get<Row>('SELECT * FROM users WHERE id = ?', id)

/** True once the owner exists: sign-up is then closed. */
export const hasOwner = (): boolean => !!get('SELECT 1 AS x FROM users LIMIT 1')

export function getUser(id: number): User | null {
  const r = row(id)
  return r ? toUser(r) : null
}

export function getOwner(): User | null {
  const r = get<Row>('SELECT * FROM users ORDER BY id LIMIT 1')
  return r ? toUser(r) : null
}

export class AuthError extends Error {}

/** Creates the one owner account. Refused when it already exists. */
export async function createOwner(email: string, password: string): Promise<User> {
  if (hasOwner()) throw new AuthError(t('An account already exists on this server.'))
  const bad = emailProblem(email) || passwordProblem(password, email)
  if (bad) throw new AuthError(bad)
  const hash = await hashPassword(password)
  const id = run(
    'INSERT INTO users(email, password_hash, created_at, password_changed_at) VALUES (?, ?, ?, ?)',
    normEmail(email), hash, now(), now(),
  ).lastInsertRowid
  return getUser(id)!
}

let dummyHash: Promise<string> | null = null

export type LoginResult =
  | { ok: true; user: User; needsSecondFactor: boolean }
  | { ok: false; reason: 'invalid' | 'locked' }

/** Checks email + password. Unknown emails take as long as known ones, and failures lock the account for 15 minutes after 10 tries. */
export async function checkCredentials(email: string, password: string): Promise<LoginResult> {
  const r = get<Row>('SELECT * FROM users WHERE email = ?', normEmail(email))
  if (!r) {
    dummyHash ??= hashPassword('not-a-real-password')
    await verifyPassword(await dummyHash, password)
    return { ok: false, reason: 'invalid' }
  }
  if (r.locked_until && r.locked_until > now()) return { ok: false, reason: 'locked' }
  if (!(await verifyPassword(r.password_hash, password))) {
    noteUserFailure(r.id)
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, user: toUser(r), needsSecondFactor: !!r.totp_enabled }
}

function noteUserFailure(id: number): void {
  const r = row(id)
  if (!r) return
  const n = r.failed_count + 1
  if (n >= MAX_FAILURES) run('UPDATE users SET failed_count = 0, locked_until = ? WHERE id = ?', now() + LOCK_MS, id)
  else run('UPDATE users SET failed_count = ? WHERE id = ?', n, id)
}

export function clearFailures(id: number): void {
  run('UPDATE users SET failed_count = 0, locked_until = NULL WHERE id = ?', id)
}

export const isLocked = (id: number): boolean => !!(row(id)?.locked_until && row(id)!.locked_until! > now())

/** Second step of the sign-in: a 6-digit code, or one of the recovery codes (each works once). */
export function checkSecondFactor(userId: number, code: string): boolean {
  const r = row(userId)
  if (!r || !r.totp_enabled || !r.totp_secret) return false
  if (r.locked_until && r.locked_until > now()) return false
  const step = verifyTotp(openSecret(r.totp_secret), code, r.totp_last_step)
  if (step !== null) {
    run('UPDATE users SET totp_last_step = ?, failed_count = 0 WHERE id = ?', step, userId)
    return true
  }
  const h = sha(normRecovery(code))
  const left = JSON.parse(r.recovery_hashes) as string[]
  if (left.includes(h)) {
    run('UPDATE users SET recovery_hashes = ?, failed_count = 0 WHERE id = ?', JSON.stringify(left.filter((x) => x !== h)), userId)
    return true
  }
  noteUserFailure(userId)
  return false
}

const normRecovery = (c: string) => c.replace(/[\s-]/g, '').toLowerCase()

function newRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: 10 }, () => {
    const raw = crypto.randomBytes(5).toString('hex')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
  return { plain, hashes: plain.map((c) => sha(normRecovery(c))) }
}

/** Starts enabling the second factor: returns the secret to scan. It only counts once confirmTotp() succeeds. */
export function beginTotp(userId: number): { secret: string; uri: string } {
  const r = row(userId)
  if (!r) throw new AuthError(t('Unknown account.'))
  if (r.totp_enabled) throw new AuthError(t('Two-factor authentication is already on.'))
  const secret = base32Encode(crypto.randomBytes(20))
  run('UPDATE users SET totp_secret = ? WHERE id = ?', sealSecret(secret), userId)
  return { secret, uri: otpauthUri(r.email, secret) }
}

/** Confirms the first code from the authenticator app, turns the second factor on and returns the recovery codes (shown once). */
export function confirmTotp(userId: number, code: string): string[] | null {
  const r = row(userId)
  if (!r || r.totp_enabled || !r.totp_secret) return null
  const step = verifyTotp(openSecret(r.totp_secret), code, 0)
  if (step === null) return null
  const rec = newRecoveryCodes()
  run('UPDATE users SET totp_enabled = 1, totp_last_step = ?, recovery_hashes = ? WHERE id = ?', step, JSON.stringify(rec.hashes), userId)
  return rec.plain
}

export function regenerateRecoveryCodes(userId: number): string[] {
  const rec = newRecoveryCodes()
  run('UPDATE users SET recovery_hashes = ? WHERE id = ?', JSON.stringify(rec.hashes), userId)
  return rec.plain
}

export function disableTotp(userId: number): void {
  run("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0, recovery_hashes = '[]' WHERE id = ?", userId)
}

export async function changePassword(userId: number, current: string, next: string): Promise<void> {
  const r = row(userId)
  if (!r || !(await verifyPassword(r.password_hash, current))) throw new AuthError(t('Current password is incorrect.'))
  await setPassword(userId, next)
}

/** Sets a new password without asking for the old one (used by the recovery command on the NAS). */
export async function setPassword(userId: number, password: string): Promise<void> {
  const r = row(userId)
  if (!r) throw new AuthError(t('Unknown account.'))
  const bad = passwordProblem(password, r.email)
  if (bad) throw new AuthError(bad)
  run('UPDATE users SET password_hash = ?, password_changed_at = ?, failed_count = 0, locked_until = NULL WHERE id = ?', await hashPassword(password), now(), userId)
}

export const listUsers = (): User[] => all<Row>('SELECT * FROM users ORDER BY id').map(toUser)
