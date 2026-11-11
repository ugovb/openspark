import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearSessionCookies, isAppRequest, sessionCookie, sessionToken } from '../src/server/web-session'

describe('web session', () => {
  it('reads the new cookie, then the legacy one', () => {
    assert.equal(sessionToken('a=1; openmail_token=new%2B; octo_token=old'), 'new+')
    assert.equal(sessionToken('octo_token=old'), 'old')
    assert.equal(sessionToken(undefined), null)
  })
  it('writes and clears cookies', () => {
    assert.equal(sessionCookie('t+1', true), 'openmail_token=t%2B1; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000; Secure')
    assert.deepEqual(clearSessionCookies(false).map((c) => c.split('=')[0]), ['openmail_token', 'octo_token'])
  })
  it('accepts both app headers', () => {
    assert.equal(isAppRequest({ 'x-openmail': '1' }), true)
    assert.equal(isAppRequest({ 'x-octo': '1' }), true)
    assert.equal(isAppRequest({}), false)
  })
})
