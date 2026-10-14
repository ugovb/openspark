// Owner account: scrypt passwords, TOTP (RFC 6238 vectors), recovery codes, lockout. No mail server needed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.OCTO_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-users-test-'))
process.env.OCTO_SECRETS = 'memory'
process.env.OCTO_QUIET = '1'

import { initCore } from '../src/core/boot'
import { setLang } from '../src/shared/i18n'
import { run } from '../src/core/db'
import {
  base32Decode, base32Encode, beginTotp, changePassword, checkCredentials, checkSecondFactor, confirmTotp, createOwner, disableTotp, hasOwner,
  hashPassword, isLocked, openSecret, passwordProblem, regenerateRecoveryCodes, sealSecret, setPassword, totpAt, verifyPassword, verifyTotp,
} from '../src/server/users'

initCore()
setLang('en') // the suite runs in Polish; these assertions check the English messages

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (6 digits = last six of the published 8-digit codes)
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')
    assert.notEqual(a, b)
    assert.match(a, /^scrypt\$32768\$8\$1\$/)
    assert.equal(await verifyPassword(a, 'correct horse battery'), true)
    assert.equal(await verifyPassword(a, 'correct horse batterz'), false)
    assert.equal(await verifyPassword('garbage', 'x'), false)
  })

  it('refuses weak passwords', () => {
    assert.ok(passwordProblem('short1'))
    assert.ok(passwordProblem('password123'))
    assert.ok(passwordProblem('aaaaaaaaaaaa'))
    assert.ok(passwordProblem('mon-ugovbo-secret', 'ugovbo@gmail.com'))
    assert.equal(passwordProblem('a long passphrase here', 'me@example.com'), null)
  })
})

describe('TOTP', () => {
  it('base32 round-trips', () => {
    const buf = Buffer.from('12345678901234567890')
    assert.equal(base32Encode(buf), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    assert.deepEqual(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), buf)
  })

  it('matches the RFC 6238 test vectors', () => {
    const at = (sec: number) => totpAt(RFC_SECRET, Math.floor(sec / 30))
    assert.equal(at(59), '287082')
    assert.equal(at(1111111109), '081804')
    assert.equal(at(1111111111), '050471')
    assert.equal(at(1234567890), '005924')
    assert.equal(at(2000000000), '279037')
  })

  it('accepts one step of drift and refuses a replayed step', () => {
    const t0 = 1_700_000_000_000
    const step = Math.floor(t0 / 1000 / 30)
    const code = totpAt(RFC_SECRET, step)
    assert.equal(verifyTotp(RFC_SECRET, code, 0, t0), step)
    assert.equal(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), 0, t0), step - 1)
    assert.equal(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step + 1), 0, t0), step + 1)
    assert.equal(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 3), 0, t0), null)
    assert.equal(verifyTotp(RFC_SECRET, code, step, t0), null) // already used
    assert.equal(verifyTotp(RFC_SECRET, '12345', 0, t0), null)
    assert.equal(verifyTotp(RFC_SECRET, 'abcdef', 0, t0), null)
  })

  it('encrypts the secret at rest', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP')
    assert.ok(!sealed.includes('JBSWY3DPEHPK3PXP'))
    assert.equal(openSecret(sealed), 'JBSWY3DPEHPK3PXP')
  })
})

describe('owner account', () => {
  it('creates one owner and closes sign-up', async () => {
    assert.equal(hasOwner(), false)
    await assert.rejects(createOwner('not-an-email', 'a long passphrase here'))
    await assert.rejects(createOwner('me@example.com', 'short'))
    const u = await createOwner('Me@Example.com', 'a long passphrase here')
    assert.equal(u.email, 'me@example.com')
    assert.equal(u.totpEnabled, false)
    assert.equal(hasOwner(), true)
    await assert.rejects(createOwner('other@example.com', 'another long passphrase'), /already exists/)
  })

  it('signs in with email and password, case-insensitively', async () => {
    const ok = await checkCredentials('ME@example.com', 'a long passphrase here')
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.needsSecondFactor, false)
    const bad = await checkCredentials('me@example.com', 'wrong passphrase!!')
    assert.deepEqual(bad, { ok: false, reason: 'invalid' })
    assert.deepEqual(await checkCredentials('nobody@example.com', 'whatever whatever'), { ok: false, reason: 'invalid' })
  })

  it('turns on the second factor and consumes recovery codes once', async () => {
    const id = (await checkCredentials('me@example.com', 'a long passphrase here')) as { ok: true; user: { id: number } }
    const uid = id.user.id
    const { secret, uri } = beginTotp(uid)
    assert.match(uri, /^otpauth:\/\/totp\/OpenSpark:me%40example\.com\?secret=[A-Z2-7]+&issuer=OpenSpark/)
    assert.equal(confirmTotp(uid, '000000'), null)
    const step = Math.floor(Date.now() / 1000 / 30)
    const codes = confirmTotp(uid, totpAt(secret, step))
    assert.ok(codes && codes.length === 10)
    assert.throws(() => beginTotp(uid), /already on/)

    const login = await checkCredentials('me@example.com', 'a long passphrase here')
    assert.equal(login.ok && login.needsSecondFactor, true)
    // the code of the step that enabled it cannot be replayed; the next step works
    assert.equal(checkSecondFactor(uid, totpAt(secret, step)), false)
    assert.equal(checkSecondFactor(uid, totpAt(secret, step + 1)), true)
    // recovery code: works once
    assert.equal(checkSecondFactor(uid, codes![0]), true)
    assert.equal(checkSecondFactor(uid, codes![0]), false)
    assert.equal(checkSecondFactor(uid, codes![1].toUpperCase().replace('-', ' ')), true)
    // regenerating invalidates the old ones
    const fresh = regenerateRecoveryCodes(uid)
    assert.equal(checkSecondFactor(uid, codes![2]), false)
    assert.equal(checkSecondFactor(uid, fresh[0]), true)
    disableTotp(uid)
    const after = await checkCredentials('me@example.com', 'a long passphrase here')
    assert.equal(after.ok && after.needsSecondFactor, false)
  })

  it('locks the account after 10 failures and unlocks on a password reset', async () => {
    run('UPDATE users SET failed_count = 0, locked_until = NULL')
    for (let i = 0; i < 10; i++) await checkCredentials('me@example.com', 'wrong passphrase!!')
    assert.deepEqual(await checkCredentials('me@example.com', 'a long passphrase here'), { ok: false, reason: 'locked' })
    const uid = 1
    assert.equal(isLocked(uid), true)
    await setPassword(uid, 'a brand new passphrase')
    assert.equal(isLocked(uid), false)
    assert.equal((await checkCredentials('me@example.com', 'a brand new passphrase')).ok, true)
  })

  it('changes the password only with the current one', async () => {
    await assert.rejects(changePassword(1, 'not the current one', 'yet another passphrase'), /incorrect/)
    await changePassword(1, 'a brand new passphrase', 'yet another passphrase')
    assert.equal((await checkCredentials('me@example.com', 'yet another passphrase')).ok, true)
    await assert.rejects(changePassword(1, 'yet another passphrase', 'short'))
  })
})
