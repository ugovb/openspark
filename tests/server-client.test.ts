// The desktop app's first contact with a home server: probe, create the account, sign in with a code.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-client-test-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'

import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServerAccount, normalizeServerUrl, pollCodeLogin, probeServer, startCodeLogin } from '../src/main/server-client'
import { runServer } from '../src/server/server'
import { getSetupCode } from '../src/server/setup'
import { sync } from '../src/core/sync'
import { setLang } from '../src/shared/i18n'

setLang('en') // the suite runs in Polish; these assertions read English messages

let server: http.Server
let base = ''
const PASSWORD = 'a long passphrase here'

describe('desktop client of the home server', () => {
  before(async () => {
    server = await runServer({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(async () => {
    server.close()
    await sync.stopAll()
  })

  it('normalizes addresses', () => {
    assert.equal(normalizeServerUrl('nas.local'), 'http://nas.local:8787')
    assert.equal(normalizeServerUrl('https://mail.example.com/'), 'https://mail.example.com')
  })

  it('probe says a new server waits for its setup code', async () => {
    const info = await probeServer(base)
    assert.equal(info.setup, true)
    assert.equal(info.account, false)
    await assert.rejects(probeServer('http://127.0.0.1:9'), /127\.0\.0\.1:9/)
  })

  it('creates the account with the setup code and returns a working config', async () => {
    await assert.rejects(createServerAccount(base, 'me@example.com', PASSWORD, 'AAAA-BBBB', 'Mac'))
    const cfg = await createServerAccount(base, 'me@example.com', PASSWORD, getSetupCode()!, 'Ugo’s Mac')
    assert.equal(cfg.deviceName, 'Ugo’s Mac')
    assert.equal((await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${cfg.token}` } })).status, 200)
    const info = await probeServer(base)
    assert.deepEqual([info.account, info.setup], [true, false])
  })

  it('signs in with a code approved from the first device', async () => {
    const first = await createServerAccount(base, 'x@example.com', PASSWORD, 'whatever', 'x').catch(() => null)
    assert.equal(first, null) // the account exists: the setup route is closed
    const { issueDevice } = await import('../src/server/auth')
    const { getOwner } = await import('../src/server/users')
    const owner = issueDevice('Approver', null, getOwner()!.id, 'password')
    const s = await startCodeLogin(base, 'Second Mac')
    assert.match(s.userCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    assert.deepEqual(await pollCodeLogin(base, s.deviceCode), { status: 'pending' })
    const ok = await fetch(`${base}/api/account/device/approve`, {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: JSON.stringify({ userCode: s.userCode, password: PASSWORD }),
    })
    assert.equal(ok.status, 200)
    const done = await pollCodeLogin(base, s.deviceCode)
    assert.equal(done.status, 'approved')
    if (done.status !== 'approved') return
    assert.equal(done.cfg.deviceName, 'Second Mac')
    assert.equal((await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${done.cfg.token}` } })).status, 200)
    assert.equal((await pollCodeLogin(base, s.deviceCode)).status, 'expired')
  })
})
