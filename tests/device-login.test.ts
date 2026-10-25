// Sign in a device with a code approved from another device. Real HTTP server, no mail server.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-devlogin-test-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'

import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createPairingCode, issueDevice, redeemPairingCode } from '../src/server/auth'
import { runServer } from '../src/server/server'
import { createOwner, deleteOwner } from '../src/server/users'
import { sync } from '../src/core/sync'

let server: http.Server
let base = ''
let approver = '' // token of a device that is signed in as the owner
const PASSWORD = 'a long passphrase here'
const realNow = Date.now

const post = (p: string, body: unknown, token?: string) =>
  fetch(`${base}${p}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) })
type Start = { userCode: string; deviceCode: string; expires: number; interval: number }
const start = async (name = 'Anna phone') => (await (await post('/api/auth/device/start', { name })).json()) as Start
const poll = async (deviceCode: string) => (await (await post('/api/auth/device/poll', { deviceCode })).json()) as { status: string; token?: string }
const approve = (userCode: string, password = PASSWORD, token = approver) => post('/api/account/device/approve', { userCode, password }, token)

describe('sign in with a code', () => {
  before(async () => {
    server = await runServer({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(async () => {
    Date.now = realNow
    server.close()
    await sync.stopAll()
  })

  it('cannot start before the account exists', async () => {
    assert.equal((await post('/api/auth/device/start', {})).status, 409)
  })

  it('start, pending, approve, token once', async () => {
    const user = await createOwner('me@example.com', PASSWORD)
    approver = issueDevice('Mac', null, user.id, 'password').token
    const s = await start()
    assert.match(s.userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    assert.equal(s.interval, 2)
    assert.equal((await poll(s.deviceCode)).status, 'pending')
    const seen = (await (await post('/api/account/device/lookup', { userCode: s.userCode }, approver)).json()) as { name: string }
    assert.equal(seen.name, 'Anna phone')
    assert.equal((await approve(s.userCode.toLowerCase())).status, 200)
    const done = await poll(s.deviceCode)
    assert.equal(done.status, 'approved')
    assert.equal((await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${done.token}` } })).status, 200)
    // the token is handed out once
    assert.equal((await poll(s.deviceCode)).status, 'expired')
  })

  it('a wrong password does not approve and the request stays pending', async () => {
    const s = await start()
    assert.equal((await approve(s.userCode, 'not the password at all')).status, 403)
    assert.equal((await poll(s.deviceCode)).status, 'pending')
  })

  it('a device that was paired by code before accounts existed cannot approve', async () => {
    const legacy = redeemPairingCode(createPairingCode().code, 'old', null)!.token
    const s = await start()
    assert.equal((await approve(s.userCode, PASSWORD, legacy)).status, 403)
    assert.equal((await post('/api/account/device/approve', { userCode: s.userCode, password: PASSWORD })).status, 401)
  })

  it('refuses an unknown code', async () => {
    assert.equal((await approve('AAAA-BBBB')).status, 404)
    assert.equal((await post('/api/account/device/lookup', { userCode: 'AAAA-BBBB' }, approver)).status, 404)
  })

  it('deny ends the request', async () => {
    const s = await start()
    assert.equal((await post('/api/account/device/deny', { userCode: s.userCode }, approver)).status, 200)
    assert.equal((await poll(s.deviceCode)).status, 'denied')
    assert.equal((await poll(s.deviceCode)).status, 'expired')
  })

  it('expires after 10 minutes', async () => {
    const s = await start()
    Date.now = () => s.expires + 1000
    try {
      assert.equal((await approve(s.userCode)).status, 404)
      assert.equal((await poll(s.deviceCode)).status, 'expired')
    } finally {
      Date.now = realNow
    }
  })

  it('keeps at most 20 live requests, dropping the oldest', async () => {
    const all: Start[] = []
    for (let i = 0; i < 21; i++) all.push(await start())
    assert.equal((await poll(all[0].deviceCode)).status, 'expired')
    assert.equal((await poll(all[1].deviceCode)).status, 'pending')
  })

  it('wrong guesses from one address get rate limited', async () => {
    const s = await start()
    let last = 0
    for (let i = 0; i < 12; i++) last = (await approve('ZZZZ-ZZZZ')).status
    assert.equal(last, 403)
    assert.equal((await approve(s.userCode)).status, 403)
    deleteOwner()
  })
})
