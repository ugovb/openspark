// A server that was paired with codes before accounts existed: the account is created from an already paired device.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

process.env.OCTO_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-account-legacy-test-'))
process.env.OCTO_SECRETS = 'memory'
process.env.OCTO_QUIET = '1'

import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createPairingCode, redeemPairingCode } from '../src/server/auth'
import { runServer } from '../src/server/server'
import { sync } from '../src/core/sync'

let server: http.Server
let base = ''
const call = (p: string, token: string, body?: unknown) =>
  fetch(`${base}${p}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('account created from an already paired device', () => {
  before(async () => {
    server = await runServer({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  after(async () => {
    server.close()
    await sync.stopAll()
  })

  it('links every device that was paired before', async () => {
    const phone = redeemPairingCode(createPairingCode().code, 'Phone', null)!.token
    const mac = redeemPairingCode(createPairingCode().code, 'Mac', null)!.token
    const before = (await (await call('/api/account', phone)).json()) as { account: boolean; user: unknown }
    assert.deepEqual([before.account, before.user], [false, null])
    assert.equal((await call('/api/account/create', phone, { email: 'me@example.com', password: 'weak' })).status, 400)
    const ok = await call('/api/account/create', phone, { email: 'me@example.com', password: 'a long passphrase here' })
    assert.equal(ok.status, 200)
    assert.equal((await call('/api/account/create', mac, { email: 'x@example.com', password: 'another long passphrase' })).status, 409)
    // both devices keep working and can manage the account
    for (const token of [phone, mac]) {
      const acc = (await (await call('/api/account', token)).json()) as { user: { email: string }; allowPairing: boolean }
      assert.equal(acc.user.email, 'me@example.com')
      assert.equal(acc.allowPairing, false)
    }
  })
})
