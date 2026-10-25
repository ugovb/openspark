import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseConnectLink } from '../src/shared/connect-link'

describe('parseConnectLink', () => {
  it('reads the server address', () => {
    assert.equal(parseConnectLink('openmail://connect?url=http://nas.local:8787'), 'http://nas.local:8787')
    assert.equal(parseConnectLink('openmail://connect?url=https%3A%2F%2Fmail.example.com%2F'), 'https://mail.example.com')
    assert.equal(parseConnectLink('openmail://connect?url=192.168.1.5'), 'http://192.168.1.5')
  })
  it('refuses anything else', () => {
    assert.equal(parseConnectLink('openmail://connect?url=javascript:alert(1)'), null)
    assert.equal(parseConnectLink('openmail://connect?url=file:///etc/passwd'), null)
    assert.equal(parseConnectLink('openmail://connect'), null)
    assert.equal(parseConnectLink('openmail://thread/4'), null)
    assert.equal(parseConnectLink('openmail://connect?url=http://user:pw@evil.example'), null)
  })
})
