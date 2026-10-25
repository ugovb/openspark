// OpenMail home server (`openmail serve`): runs the whole engine 24/7 (sync, Send Later, snooze,
// reminders, rules) and exposes the service API to paired desktop apps and browsers.
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { CoreEvent } from '../shared/types'
import { LOCAL_ONLY_METHODS, STREAMING_METHODS } from '../shared/streaming'
import { decodeWire, encodeWire, SERVER_DEFAULT_PORT, type ServerInfo } from '../shared/wire'
import { initCore, startEngine, stopEngine } from '../core/boot'
import { get } from '../core/db'
import { bus, log } from '../core/events'
import { createService } from '../core/service'
import { t } from '../shared/i18n'
import {
  authenticate, closeTicket, createPairingCode, createTicket, issueDevice, linkLegacyDevices, listDevices, noteFailure, pairingAllowed, redeemPairingCode,
  revokeAllDevices, revokeDevice, setPairingAllowed, tooManyFailures, useTicket,
} from './auth'
import { approveDeviceLogin, denyDeviceLogin, lookupDeviceLogin, pollDeviceLogin, startDeviceLogin } from './device-login'
import { redeemSetupCode } from './setup'
import { type AuthView, authMessage, authPage, browserDeviceName, langFromAcceptLanguage, loginPage, withLang } from './login'
import {
  AuthError, beginTotp, changePassword, checkCredentials, checkSecondFactor, clearFailures, confirmTotp, createOwner, disableTotp, emailProblem, getUser,
  hasOwner, isLocked, passwordProblem, regenerateRecoveryCodes, type User,
} from './users'
import { APP_VERSION } from '../shared/version'
import { env } from '../shared/env'

export const SERVER_VERSION = APP_VERSION

export interface ServeOptions {
  port?: number
  host?: string
  webRoot?: string | null
}

type Fn = (...a: unknown[]) => unknown
const MAX_BODY = 48 * 1024 * 1024
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}

/**
 * Address of the caller. Behind a reverse proxy (DSM, nginx, Caddy) every request arrives from the proxy, so with
 * OCTO_TRUST_PROXY=1 the left-most X-Forwarded-For entry is used; otherwise only the socket address is trusted.
 */
export function clientIp(req: http.IncomingMessage): string {
  if (env('TRUST_PROXY') === '1') {
    const xff = req.headers['x-forwarded-for']
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
    if (first) return first.replace(/^::ffff:/, '')
  }
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
}

/** "; Secure" when the browser reached us over HTTPS through a trusted proxy. */
export function secureFlag(req: http.IncomingMessage): string {
  return env('TRUST_PROXY') === '1' && req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
}

function cookie(req: http.IncomingMessage, name: string): string | null {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

/** 303 back to the app with the device token in an HttpOnly cookie. */
function signedIn(req: http.IncomingMessage, res: http.ServerResponse, token: string): void {
  res.writeHead(303, {
    Location: '/',
    'Set-Cookie': `octo_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secureFlag(req)}`,
  })
  res.end()
}

/** Form posts (the sign-in pages) and JSON bodies (the desktop app) both end up as a plain object. */
function parseFields(raw: string): { fields: Record<string, string>; json: boolean } {
  if (raw.trimStart().startsWith('{')) {
    const o = decodeWire<Record<string, unknown>>(raw)
    return { fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined || v === null ? '' : String(v)])), json: true }
  }
  return { fields: Object.fromEntries(new URLSearchParams(raw)), json: false }
}

const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const text = typeof body === 'string' ? body : encodeWire(body)
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(text)
}

function readBody(req: http.IncomingMessage, limit = MAX_BODY): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error(t('Request too large')))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Files the login page (and "Add to Home Screen") may load before the browser is paired. */
const PUBLIC_FILES = new Set(['/logo.svg', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'])

export function lanAddresses(port: number): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`)
  }
  return out
}

export async function runServer(opts: ServeOptions = {}): Promise<http.Server> {
  const port = opts.port ?? SERVER_DEFAULT_PORT
  const host = opts.host ?? '0.0.0.0'
  initCore()
  await startEngine('server')
  const svc = createService('ui') as unknown as Record<string, Fn>
  const webRoot = opts.webRoot && fs.existsSync(path.join(opts.webRoot, 'index.html')) ? path.resolve(opts.webRoot) : null

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://local')
    const ip = clientIp(req)
    // pages for browsers follow the browser's language; API errors follow the server's settings
    const lang = langFromAcceptLanguage(req.headers['accept-language'])
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    try {
      // ---------- public endpoints ----------
      if (url.pathname === '/api/info') {
        const info: Omit<ServerInfo, 'accounts' | 'engine'> & { pairing: boolean; account: boolean; setup: boolean } = {
          name: 'openmail-server', version: SERVER_VERSION, hostname: os.hostname(), pairing: pairingAllowed(), account: hasOwner(), setup: !hasOwner(),
        }
        return send(res, 200, info)
      }
      if (url.pathname === '/api/pair' && req.method === 'POST') {
        if (tooManyFailures(ip)) return send(res, 429, { error: t('Too many failed attempts — wait 10 minutes') })
        if (!pairingAllowed()) return send(res, 403, { error: t('Pairing codes are switched off. Sign in with your email and password.') })
        const body = decodeWire<{ code?: string; name?: string }>((await readBody(req, 4096)).toString('utf8'))
        const r = redeemPairingCode(String(body.code || ''), String(body.name || t('Computer')), ip)
        if (!r) {
          noteFailure(ip)
          return send(res, 403, { error: t('Invalid or expired pairing code') })
        }
        log('server', `paired device "${r.device.name}" from ${ip}`)
        return send(res, 200, r)
      }
      if (url.pathname === '/api/login' && req.method === 'POST') {
        if (tooManyFailures(ip)) return send(res, 429, loginPage(lang, 'too-many'), { 'Content-Type': 'text/html; charset=utf-8' })
        const form = new URLSearchParams((await readBody(req, 4096)).toString('utf8'))
        const ua = String(req.headers['user-agent'] || '')
        if (!pairingAllowed()) {
          res.writeHead(403, HTML)
          return res.end(authPage(lang, { view: 'login', allowPairing: false, error: { text: withLang(lang, () => t('Pairing codes are switched off. Sign in with your email and password.')) } }))
        }
        const r = redeemPairingCode(form.get('code') || '', browserDeviceName(lang, ua, ip), ip)
        if (!r) {
          noteFailure(ip)
          res.writeHead(403, HTML)
          return res.end(loginPage(lang, 'bad-code'))
        }
        return signedIn(req, res, r.token)
      }

      // ---------- email + password (+ second factor) ----------
      const page = (status: number, v: AuthView) => {
        res.writeHead(status, HTML)
        return res.end(authPage(lang, v))
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const { fields, json } = parseFields((await readBody(req, 8192)).toString('utf8'))
        const fail = (status: number, key: 'invalid' | 'locked' | 'too-many') =>
          json ? send(res, status, { error: authMessage(key) }) : page(status, { view: 'login', error: key, email: fields.email, allowPairing: pairingAllowed() })
        if (tooManyFailures(ip)) return fail(429, 'too-many')
        const r = await checkCredentials(fields.email || '', fields.password || '')
        if (!r.ok) {
          noteFailure(ip)
          return fail(r.reason === 'locked' ? 429 : 401, r.reason)
        }
        const name = json && fields.name ? fields.name : browserDeviceName(lang, String(req.headers['user-agent'] || ''), ip)
        if (r.needsSecondFactor) {
          const ticket = createTicket(r.user.id, name)
          return json ? send(res, 200, { needs2fa: true, ticket }) : page(200, { view: 'totp', ticket })
        }
        clearFailures(r.user.id)
        const d = issueDevice(name, ip, r.user.id, 'password')
        log('server', `signed in "${d.device.name}" from ${ip}`)
        return json ? send(res, 200, d) : signedIn(req, res, d.token)
      }
      if (url.pathname === '/api/auth/totp' && req.method === 'POST') {
        const { fields, json } = parseFields((await readBody(req, 8192)).toString('utf8'))
        const fail = (status: number, key: 'expired' | 'bad-totp' | 'locked' | 'too-many') =>
          json ? send(res, status, { error: authMessage(key) })
            : key === 'bad-totp' ? page(status, { view: 'totp', ticket: fields.ticket || '', error: key })
              : page(status, { view: 'login', error: key, allowPairing: pairingAllowed() })
        if (tooManyFailures(ip)) return fail(429, 'too-many')
        const k = useTicket(fields.ticket || '')
        if (!k) return fail(401, 'expired')
        if (isLocked(k.userId)) return fail(429, 'locked')
        if (!checkSecondFactor(k.userId, fields.code || '')) {
          noteFailure(ip)
          return fail(401, isLocked(k.userId) ? 'locked' : 'bad-totp')
        }
        closeTicket(fields.ticket)
        clearFailures(k.userId)
        const d = issueDevice(k.name, ip, k.userId, 'password')
        log('server', `signed in (2FA) "${d.device.name}" from ${ip}`)
        return json ? send(res, 200, d) : signedIn(req, res, d.token)
      }
      // sign in with a code: the new device shows it, a signed-in device approves it (see device-login.ts)
      if (url.pathname === '/api/auth/device/start' && req.method === 'POST') {
        if (!hasOwner()) return send(res, 409, { error: withLang(lang, () => t('Create the account first.')) })
        if (tooManyFailures(ip)) return send(res, 429, { error: authMessage('too-many') })
        const { fields } = parseFields((await readBody(req, 4096)).toString('utf8') || '{}')
        const name = fields.name ? String(fields.name) : browserDeviceName(lang, String(req.headers['user-agent'] || ''), ip)
        return send(res, 200, startDeviceLogin(name, ip))
      }
      if (url.pathname === '/api/auth/device/poll' && req.method === 'POST') {
        if (tooManyFailures(ip)) return send(res, 429, { error: authMessage('too-many') })
        const { fields } = parseFields((await readBody(req, 4096)).toString('utf8') || '{}')
        const r = pollDeviceLogin(fields.deviceCode || '', ip)
        if (r.status === 'expired') noteFailure(ip)
        if (r.status === 'approved') log('server', `signed in with a code "${r.device.name}" from ${ip}`)
        // the sign-in page asks for the cookie instead of the token, so the token never reaches its script
        if (r.status === 'approved' && fields.cookie === '1') {
          return send(res, 200, { status: 'approved' }, { 'Set-Cookie': `octo_token=${encodeURIComponent(r.token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secureFlag(req)}` })
        }
        return send(res, 200, r)
      }
      if (url.pathname === '/api/auth/setup' && req.method === 'POST') {
        // first account of the server: needs a pairing code (proof of access to the NAS); afterwards sign-up is closed
        const { fields, json } = parseFields((await readBody(req, 8192)).toString('utf8'))
        const fail = (status: number, text: string) =>
          json ? send(res, status, { error: text }) : page(status, { view: 'setup', error: { text }, email: fields.email })
        // a stale or repeated form: there is nothing to create any more, so send the person to the sign-in page
        if (hasOwner()) {
          return json
            ? send(res, 403, { error: withLang(lang, () => t('An account already exists on this server.')) })
            : page(409, { view: 'login', error: 'account-exists', email: fields.email, allowPairing: pairingAllowed() })
        }
        if (tooManyFailures(ip)) return fail(429, authMessage('too-many'))
        const problem = withLang(lang, () =>
          emailProblem(fields.email || '') || (fields.password !== (fields.password2 ?? fields.password) ? t('The passwords do not match.') : passwordProblem(fields.password || '', fields.email)))
        if (problem) return fail(400, problem)
        const deviceName = browserDeviceName(lang, String(req.headers['user-agent'] || ''), ip)
        // the setup code (log line or OPENMAIL_SETUP_CODE) or, as before, a pairing code
        const viaSetup = redeemSetupCode(fields.code || '')
        let paired = viaSetup ? null : redeemPairingCode(fields.code || '', deviceName, ip)
        if (!viaSetup && !paired) {
          noteFailure(ip)
          return fail(403, authMessage('bad-code'))
        }
        let user: User
        try {
          user = await createOwner(fields.email, fields.password)
        } catch (e) {
          return fail(400, e instanceof AuthError ? e.message : String((e as Error).message))
        }
        paired ??= issueDevice(deviceName, ip, user.id, 'password')
        linkLegacyDevices(user.id)
        setPairingAllowed(false)
        log('server', `owner account created (${user.email}) from ${ip}`)
        return json ? send(res, 200, { ...paired, user }) : signedIn(req, res, paired.token)
      }

      // ---------- authentication ----------
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null
      const viaCookie = !bearer
      const device = authenticate(bearer || cookie(req, 'octo_token'), ip)

      if (!url.pathname.startsWith('/api/')) {
        // web UI (desktop browsers and phones)
        if (!webRoot) return send(res, 404, withLang(lang, () => t('The web interface is not available in this installation.')))
        if (!device && !PUBLIC_FILES.has(url.pathname) && !url.pathname.startsWith('/assets/')) {
          res.writeHead(200, HTML)
          if (!hasOwner()) return res.end(authPage(lang, url.searchParams.get('pair') ? { view: 'pair' } : { view: 'setup' }))
          if (url.searchParams.get('code')) return res.end(authPage(lang, { view: 'code' }))
          if (url.searchParams.get('pair') && pairingAllowed()) return res.end(authPage(lang, { view: 'pair', hasOwner: true }))
          return res.end(authPage(lang, { view: 'login', allowPairing: pairingAllowed() }))
        }
        const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))
        let file = path.resolve(webRoot, rel)
        if (!file.startsWith(webRoot + path.sep) && file !== webRoot) return send(res, 403, 'forbidden')
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(webRoot, 'index.html')
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        })
        return fs.createReadStream(file).pipe(res)
      }

      if (!device) return send(res, 401, { error: t('Not authorized — pair this device with the server') })
      // cookie-authenticated writes must come from our own page (custom header = no cross-site forms)
      if (viaCookie && req.method !== 'GET' && req.headers['x-octo'] !== '1') return send(res, 403, { error: t('Missing X-Octo header') })

      if (url.pathname === '/api/me') return send(res, 200, { device })
      if (url.pathname === '/api/logout' && req.method === 'POST') {
        revokeDevice(device.id)
        return send(res, 200, { ok: true }, { 'Set-Cookie': `octo_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag(req)}` })
      }
      if (url.pathname === '/api/devices' && req.method === 'GET') return send(res, 200, { devices: listDevices() })
      if (url.pathname === '/api/devices/pair' && req.method === 'POST') {
        if (!pairingAllowed()) return send(res, 403, { error: t('Pairing codes are switched off. Sign in with your email and password.') })
        const body = decodeWire<{ name?: string }>((await readBody(req, 4096)).toString('utf8') || '{}')
        return send(res, 200, createPairingCode(body.name))
      }
      const del = url.pathname.match(/^\/api\/devices\/([a-f0-9]+)$/)
      if (del && req.method === 'DELETE') return send(res, 200, { ok: revokeDevice(del[1]) })

      // ---------- the owner account (managed from a device that is signed in) ----------
      if (url.pathname.startsWith('/api/account')) {
        const owner = hasOwner() ? getUser(device.userId ?? -1) : null
        const body = req.method === 'POST' ? parseFields((await readBody(req, 8192)).toString('utf8') || '{}').fields : {}
        const info = () => ({ account: hasOwner(), user: owner, allowPairing: pairingAllowed() })
        if (url.pathname === '/api/account' && req.method === 'GET') return send(res, 200, info())
        if (req.method !== 'POST') return send(res, 404, { error: t('Not found') })

        if (url.pathname === '/api/account/create') {
          if (hasOwner()) return send(res, 409, { error: t('An account already exists on this server.') })
          const problem = emailProblem(body.email || '') || passwordProblem(body.password || '', body.email)
          if (problem) return send(res, 400, { error: problem })
          try {
            const u = await createOwner(body.email, body.password)
            linkLegacyDevices(u.id)
            setPairingAllowed(false)
            log('server', `owner account created (${u.email}) from ${ip}`)
            return send(res, 200, { ...info(), user: u })
          } catch (e) {
            return send(res, 400, { error: (e as Error).message })
          }
        }
        if (!owner) return send(res, 403, { error: t('Sign in with your email and password to manage the account.') })

        // changing security settings asks for the password again (and a 2FA code when it is on)
        const confirm = async (needCode: boolean): Promise<string | null> => {
          if (tooManyFailures(ip)) return t('Too many failed attempts — wait 10 minutes')
          const r = await checkCredentials(owner.email, body.password || '')
          if (!r.ok) {
            noteFailure(ip)
            return r.reason === 'locked' ? authMessage('locked') : t('Current password is incorrect.')
          }
          if (needCode && owner.totpEnabled && !checkSecondFactor(owner.id, body.code || '')) {
            noteFailure(ip)
            return authMessage('bad-totp')
          }
          return null
        }
        const refuse = (msg: string) => send(res, 403, { error: msg })

        try {
          switch (url.pathname) {
            case '/api/account/password': {
              if (tooManyFailures(ip)) return refuse(t('Too many failed attempts — wait 10 minutes'))
              try {
                await changePassword(owner.id, body.current || '', body.next || '')
              } catch (e) {
                noteFailure(ip)
                throw e
              }
              return send(res, 200, { ok: true })
            }
            case '/api/account/totp/begin': {
              const bad = await confirm(false)
              return bad ? refuse(bad) : send(res, 200, beginTotp(owner.id))
            }
            case '/api/account/totp/confirm': {
              const codes = confirmTotp(owner.id, body.code || '')
              return codes ? send(res, 200, { recovery: codes, user: getUser(owner.id) }) : send(res, 400, { error: authMessage('bad-totp') })
            }
            case '/api/account/totp/disable': {
              const bad = await confirm(true)
              if (bad) return refuse(bad)
              disableTotp(owner.id)
              return send(res, 200, { user: getUser(owner.id) })
            }
            case '/api/account/recovery': {
              const bad = await confirm(true)
              return bad ? refuse(bad) : send(res, 200, { recovery: regenerateRecoveryCodes(owner.id) })
            }
            case '/api/account/pairing': {
              const bad = await confirm(true)
              if (bad) return refuse(bad)
              setPairingAllowed(body.allow === 'true')
              return send(res, 200, info())
            }
            case '/api/account/device/lookup': {
              if (tooManyFailures(ip)) return refuse(t('Too many failed attempts — wait 10 minutes'))
              const r = lookupDeviceLogin(body.userCode || '')
              if (!r) {
                noteFailure(ip)
                return send(res, 404, { error: t('Invalid or expired code.') })
              }
              return send(res, 200, r)
            }
            case '/api/account/device/approve': {
              const bad = await confirm(true)
              if (bad) return refuse(bad)
              if (!approveDeviceLogin(body.userCode || '', owner.id)) {
                noteFailure(ip)
                return send(res, 404, { error: t('Invalid or expired code.') })
              }
              log('server', `device sign-in approved by ${owner.email} from ${ip}`)
              return send(res, 200, { ok: true })
            }
            case '/api/account/device/deny': {
              return send(res, 200, { ok: denyDeviceLogin(body.userCode || '', owner.id) })
            }
            case '/api/account/revoke-all': {
              const bad = await confirm(true)
              if (bad) return refuse(bad)
              revokeAllDevices()
              return send(res, 200, { ok: true }, { 'Set-Cookie': `octo_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag(req)}` })
            }
          }
        } catch (e) {
          return send(res, e instanceof AuthError ? 400 : 500, { error: (e as Error).message })
        }
        return send(res, 404, { error: t('Not found') })
      }

      if (url.pathname === '/api/call' && req.method === 'POST') {
        const { method, args } = decodeWire<{ method: string; args: unknown[] }>((await readBody(req)).toString('utf8'))
        const fn = svc[method]
        if (typeof fn !== 'function' || LOCAL_ONLY_METHODS.has(method) || method === 'actor') return send(res, 400, { error: t('Unknown method {method}', { method }) })
        // devices, pairing codes and the pairing switch live under server.* and are only changed through the account routes
        if ((method === 'getKV' || method === 'setKV') && String(args?.[0] ?? '').startsWith('server.')) return send(res, 403, { error: t('Forbidden') })
        try {
          return send(res, 200, { result: await fn(...(args || [])) })
        } catch (e) {
          return send(res, 200, { error: (e as Error).message || String(e) })
        }
      }

      if (url.pathname === '/api/stream' && req.method === 'POST') {
        const { method, args } = decodeWire<{ method: string; args: unknown[] }>((await readBody(req)).toString('utf8'))
        const at = STREAMING_METHODS[method]
        if (at === undefined) return send(res, 400, { error: t('Method {method} does not support streaming', { method }) })
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' })
        const a = [...(args || [])].slice(0, at)
        while (a.length < at) a.push(undefined)
        a[at] = (text: string) => res.write(encodeWire({ delta: text }) + '\n')
        try {
          const result = await svc[method](...a)
          res.end(encodeWire({ result }) + '\n')
        } catch (e) {
          res.end(encodeWire({ error: (e as Error).message }) + '\n')
        }
        return
      }

      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
        res.write(': octopus\n\n')
        const off = bus.onEvent((ev: CoreEvent) => res.write(`data: ${encodeWire(ev)}\n\n`))
        const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
        req.on('close', () => {
          off()
          clearInterval(ping)
        })
        return
      }

      const att = url.pathname.match(/^\/api\/attachment\/(\d+)$/)
      if (att) {
        const file = (await svc.downloadAttachment(Number(att[1]))) as string
        const row = get<{ filename: string; mime: string }>('SELECT filename, mime FROM attachments WHERE id = ?', Number(att[1]))
        const name = encodeURIComponent(row?.filename || path.basename(file))
        res.writeHead(200, {
          'Content-Type': row?.mime || 'application/octet-stream',
          'Content-Length': String(fs.statSync(file).size),
          'Content-Disposition': `${url.searchParams.get('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${name}`,
          'Cache-Control': 'private, max-age=3600',
        })
        return fs.createReadStream(file).pipe(res)
      }

      const cid = url.pathname.match(/^\/api\/cid\/(\d+)\/(.+)$/)
      if (cid) {
        const ref = decodeURIComponent(cid[2])
        const a = get<{ id: number; mime: string }>('SELECT id, mime FROM attachments WHERE message_id = ? AND (content_id = ? OR filename = ?)', Number(cid[1]), ref, ref)
        if (!a) return send(res, 404, 'not found')
        const file = (await svc.downloadAttachment(a.id)) as string
        res.writeHead(200, { 'Content-Type': a.mime || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' })
        return fs.createReadStream(file).pipe(res)
      }

      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const name = url.searchParams.get('name') || t('file')
        const data = await readBody(req)
        return send(res, 200, { result: svc.stageAttachment(name, new Uint8Array(data)) })
      }

      return send(res, 404, { error: t('Not found') })
    } catch (e) {
      log('server', 'request failed', req.method, url.pathname, (e as Error).message)
      if (!res.headersSent) send(res, 500, { error: (e as Error).message })
      else res.end()
    }
  })

  server.requestTimeout = 0 // SSE and AI streams stay open
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })
  const shutdown = async () => {
    server.close()
    await stopEngine()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
  return server
}
