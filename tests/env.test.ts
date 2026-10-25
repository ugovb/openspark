import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { env, envFlag } from '../src/shared/env'

const KEYS = ['OPENMAIL_HOME', 'OCTO_HOME', 'OPENMAIL_QUIET', 'OCTO_QUIET']
afterEach(() => KEYS.forEach((k) => delete process.env[k]))

describe('env()', () => {
  it('OPENMAIL_ wins over OCTO_', () => {
    process.env.OCTO_HOME = '/old'
    process.env.OPENMAIL_HOME = '/new'
    assert.equal(env('HOME'), '/new')
  })
  it('falls back to OCTO_', () => {
    process.env.OCTO_HOME = '/old'
    assert.equal(env('HOME'), '/old')
  })
  it('an empty value counts as unset', () => {
    process.env.OPENMAIL_HOME = ''
    process.env.OCTO_HOME = '/old'
    assert.equal(env('HOME'), '/old')
  })
  it('envFlag understands 1/true/yes only', () => {
    process.env.OPENMAIL_QUIET = '1'
    assert.equal(envFlag('QUIET'), true)
    process.env.OPENMAIL_QUIET = 'true'
    assert.equal(envFlag('QUIET'), true)
    process.env.OPENMAIL_QUIET = '0'
    assert.equal(envFlag('QUIET'), false)
    delete process.env.OPENMAIL_QUIET
    assert.equal(envFlag('QUIET'), false)
  })
})
