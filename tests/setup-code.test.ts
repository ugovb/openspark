// The setup code: lets a person create the first account without a terminal on the server.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-setup-test-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'

import { initCore } from '../src/core/boot'
import { createOwner, deleteOwner } from '../src/server/users'
import { getSetupCode, redeemSetupCode } from '../src/server/setup'

initCore()
afterEach(() => {
  delete process.env.OPENMAIL_SETUP_CODE
  deleteOwner()
})

describe('setup code', () => {
  it('is generated once and stays the same', () => {
    const a = getSetupCode()!
    assert.match(a, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    assert.equal(getSetupCode(), a)
  })

  it('uses OPENMAIL_SETUP_CODE when it is valid', () => {
    process.env.OPENMAIL_SETUP_CODE = 'my-nas-secret'
    assert.equal(getSetupCode(), 'my-nas-secret')
    assert.equal(redeemSetupCode('MY-NAS-SECRET'), true)
    assert.equal(redeemSetupCode('mynassecret'), true)
  })

  it('ignores a too short or spaced OPENMAIL_SETUP_CODE and generates its own', () => {
    process.env.OPENMAIL_SETUP_CODE = 'short7!'
    const a = getSetupCode()!
    assert.match(a, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    process.env.OPENMAIL_SETUP_CODE = 'has some spaces'
    assert.equal(getSetupCode(), a)
  })

  it('accepts the code in lower case, without the hyphen and with spaces', () => {
    const c = getSetupCode()!
    assert.equal(redeemSetupCode(c.toLowerCase()), true)
    assert.equal(redeemSetupCode(c.replace('-', '')), true)
    assert.equal(redeemSetupCode(` ${c} `), true)
  })

  it('refuses a wrong or empty code', () => {
    getSetupCode()
    assert.equal(redeemSetupCode('AAAA-BBBB'), false)
    assert.equal(redeemSetupCode(''), false)
  })

  it('is gone once the account exists', async () => {
    const c = getSetupCode()!
    await createOwner('me@example.com', 'a long passphrase here')
    assert.equal(getSetupCode(), null)
    assert.equal(redeemSetupCode(c), false)
  })
})
