// Home-server account: first-time creation with a pairing code, sign-in, two-step verification, recovery codes,
// sign-up closing, pairing switched off. Runs the real HTTP server; no mail server needed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.OCTO_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-account-test-'))
process.env.OCTO_SECRETS = 'memory'
process.env.OCTO_QUIET = '1'

import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createPairingCode } from '../src/server/auth'
import { runServer } from '../src/server/server'
import { sync } from '../src/core/sync'
import { totpAt } from '../src/server/users'

let server: http.Server
let base = ''
const PASSWORD = 'a long passphrase here'
const json = (path: string, body: unknown, token?: string) =>
  fetch(`${base}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) })
const get = (path: string, token?: string) => fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
const step = () => Math.floor(Date.now() / 1000 / 30)

let token = ''
let secret = ''
let recovery: string[] = []

describe('home-server account', () => {
  before(async () => {
    const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-web-'))
    fs.writeFileSync(path.join(webRoot, 'index.html'), '<!doctype html><title>app</title>')
    server = await runServer({ port: 0, host: '127.0.0.1', webRoot })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(async () => {
    server.close()
    await sync.stopAll()
  })

  it('offers account creation on the sign-in page while there is no account', async () => {
    const html = await (await fetch(`${base}/`, { headers: { 'accept-language': 'fr' } })).text()
    assert.match(html, /action="\/api\/auth\/setup"/)
    assert.match(html, /Créer votre compte/)
    const info = (await (await get('/api/info')).json()) as { account: boolean; pairing: boolean }
    assert.deepEqual([info.account, info.pairing], [false, true])
  })

  it('creates the account only with a valid pairing code and a sound password', async () => {
    const code = createPairingCode().code
    assert.equal((await json('/api/auth/setup', { code: 'WRNG-CODE', email: 'me@example.com', password: PASSWORD })).status, 403)
    // a typo in the password must not burn the code
    assert.equal((await json('/api/auth/setup', { code, email: 'me@example.com', password: 'short' })).status, 400)
    assert.equal((await json('/api/auth/setup', { code, email: 'not-an-email', password: PASSWORD })).status, 400)
    assert.equal((await json('/api/auth/setup', { code, email: 'me@example.com', password: PASSWORD, password2: 'different one!!' })).status, 400)
    const ok = await json('/api/auth/setup', { code, email: 'Me@Example.com', password: PASSWORD })
    assert.equal(ok.status, 200)
    const body = (await ok.json()) as { token: string; user: { email: string } }
    assert.equal(body.user.email, 'me@example.com')
    token = body.token
    assert.equal((await get('/api/me', token)).status, 200)
  })

  it('closes sign-up and switches pairing codes off once the account exists', async () => {
    assert.equal((await json('/api/auth/setup', { code: createPairingCode().code, email: 'x@example.com', password: PASSWORD })).status, 403)
    const info = (await (await get('/api/info')).json()) as { account: boolean; pairing: boolean }
    assert.deepEqual([info.account, info.pairing], [true, false])
    assert.equal((await json('/api/pair', { code: createPairingCode().code, name: 'T' })).status, 403)
    assert.equal((await json('/api/devices/pair', {}, token)).status, 403)
    const html = await (await fetch(`${base}/`)).text()
    assert.match(html, /action="\/api\/auth\/login"/)
    assert.doesNotMatch(html, /pair=1/)
  })

  it('signs in with email and password', async () => {
    assert.equal((await json('/api/auth/login', { email: 'me@example.com', password: 'wrong passphrase!!' })).status, 401)
    const r = await json('/api/auth/login', { email: 'ME@example.com', password: PASSWORD, name: 'Test Mac' })
    assert.equal(r.status, 200)
    const b = (await r.json()) as { token: string; device: { name: string; method: string } }
    assert.equal(b.device.name, 'Test Mac')
    assert.equal(b.device.method, 'password')
    assert.equal((await get('/api/me', b.token)).status, 200)
  })

  it('asks for the password before security changes', async () => {
    assert.equal((await get('/api/account')).status, 401)
    assert.equal((await json('/api/account/totp/begin', { password: 'nope nope nope' }, token)).status, 403)
    const begin = await json('/api/account/totp/begin', { password: PASSWORD }, token)
    assert.equal(begin.status, 200)
    const b = (await begin.json()) as { secret: string; uri: string }
    assert.match(b.uri, /^otpauth:\/\/totp\/OpenSpark:/)
    secret = b.secret
    assert.equal((await json('/api/account/totp/confirm', { code: '000000' }, token)).status, 400)
    const ok = await json('/api/account/totp/confirm', { code: totpAt(secret, step()) }, token)
    assert.equal(ok.status, 200)
    recovery = ((await ok.json()) as { recovery: string[] }).recovery
    assert.equal(recovery.length, 10)
    const acc = (await (await get('/api/account', token)).json()) as { user: { totpEnabled: boolean; recoveryLeft: number } }
    assert.deepEqual([acc.user.totpEnabled, acc.user.recoveryLeft], [true, 10])
  })

  it('needs the second factor to sign in once it is on', async () => {
    const r = await json('/api/auth/login', { email: 'me@example.com', password: PASSWORD })
    const { needs2fa, ticket } = (await r.json()) as { needs2fa: boolean; ticket: string }
    assert.equal(needs2fa, true)
    assert.equal((await json('/api/auth/totp', { ticket, code: '123456' })).status, 401)
    assert.equal((await json('/api/auth/totp', { ticket: 'unknown', code: totpAt(secret, step() + 1) })).status, 401)
    const ok = await json('/api/auth/totp', { ticket, code: totpAt(secret, step() + 1) })
    assert.equal(ok.status, 200)
    assert.equal((await get('/api/me', ((await ok.json()) as { token: string }).token)).status, 200)
    // the ticket is single use
    assert.equal((await json('/api/auth/totp', { ticket, code: totpAt(secret, step() + 1) })).status, 401)
  })

  it('accepts each recovery code once', async () => {
    const login = async () => ((await (await json('/api/auth/login', { email: 'me@example.com', password: PASSWORD })).json()) as { ticket: string }).ticket
    const first = await json('/api/auth/totp', { ticket: await login(), code: recovery[0] })
    assert.equal(first.status, 200)
    const again = await json('/api/auth/totp', { ticket: await login(), code: recovery[0] })
    assert.equal(again.status, 401)
  })

  it('turns pairing codes back on, then off, with password and code', async () => {
    const body = (allow: boolean, extra = {}) => ({ allow, password: PASSWORD, code: recovery[1], ...extra })
    assert.equal((await json('/api/account/pairing', body(true, { password: 'nope nope nope' }), token)).status, 403)
    const on = await json('/api/account/pairing', body(true), token)
    assert.equal(on.status, 200)
    assert.equal(((await on.json()) as { allowPairing: boolean }).allowPairing, true)
    assert.equal((await json('/api/account/pairing', { allow: false, password: PASSWORD, code: recovery[2] }, token)).status, 200)
  })

  it('signs every device out', async () => {
    const r = await json('/api/account/revoke-all', { password: PASSWORD, code: recovery[3] }, token)
    assert.equal(r.status, 200)
    assert.equal((await get('/api/me', token)).status, 401)
  })
})
