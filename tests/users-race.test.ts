// Two sign-ups at the same moment create one account; the recovery command can delete it so sign-up opens again.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-users-race-test-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'

import { initCore } from '../src/core/boot'
import { setLang } from '../src/shared/i18n'
import { issueDevice, listDevices, revokeAllDevices } from '../src/server/auth'
import { checkCredentials, createOwner, deleteOwner, hasOwner, listUsers } from '../src/server/users'

initCore()
setLang('en')

describe('owner account creation', () => {
  it('creates a single account when two requests arrive together', async () => {
    const results = await Promise.allSettled([
      createOwner('first@example.com', 'a long passphrase here'),
      createOwner('second@example.com', 'another long passphrase'),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    assert.match(String(failed.reason), /already exists/)
    assert.equal(listUsers().length, 1)
  })

  it('opens sign-up again after the account is deleted', async () => {
    issueDevice('Phone', null, 1, 'password')
    assert.equal(listDevices().length, 1)
    assert.equal(deleteOwner(), true)
    revokeAllDevices()
    assert.equal(hasOwner(), false)
    assert.equal(listDevices().length, 0)
    assert.deepEqual(await checkCredentials('first@example.com', 'a long passphrase here'), { ok: false, reason: 'invalid' })
    assert.equal(deleteOwner(), false)
    const again = await createOwner('new@example.com', 'a long passphrase here')
    assert.equal(again.email, 'new@example.com')
  })
})
