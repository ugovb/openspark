// The unit run (no GreenMail) must drop exactly the mail-server tests; the full run keeps every engine test.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { MAIL_SERVER_TESTS, selectTests } from '../scripts/test-files.mjs'

const all = ['a.test.ts', 'integration.test.ts', 'server.test.ts', 'server-client.test.ts', 'demo-seed.ts', 'calendar.test.mjs']

describe('test file selection', () => {
  it('full run keeps every engine test', () =>
    assert.deepEqual(selectTests(all, { unit: false }), ['a.test.ts', 'integration.test.ts', 'server.test.ts', 'server-client.test.ts']))
  it('unit run drops the mail-server tests only', () => assert.deepEqual(selectTests(all, { unit: true }), ['a.test.ts', 'server-client.test.ts']))
  it('filter still works', () => assert.deepEqual(selectTests(all, { unit: true, filter: 'server' }), ['server-client.test.ts']))
  it('lists files that exist', () => {
    for (const f of MAIL_SERVER_TESTS) assert.ok(fs.existsSync(path.join('tests', f)), f)
  })
})
