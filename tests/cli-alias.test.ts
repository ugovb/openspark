import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { deprecatedAlias } from '../src/cli/alias'

const root = process.cwd()
const run = (file: string) =>
  spawnSync(process.execPath, [path.join(root, 'out', 'cli', file), 'help'], {
    encoding: 'utf8',
    env: { ...process.env, OPENMAIL_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-alias-')), OPENMAIL_SECRETS: 'memory', OPENMAIL_QUIET: '1' },
  })

describe('octo alias', () => {
  it('notice only for the old name', () => {
    assert.match(deprecatedAlias('octo') || '', /openmail/)
    assert.equal(deprecatedAlias('openmail'), null)
    assert.equal(deprecatedAlias(undefined), null)
  })
  it('both built commands print the same usage; only octo warns, on stderr', { skip: !fs.existsSync(path.join(root, 'out/cli/octo.js')) }, () => {
    const a = run('openmail.js')
    const b = run('octo.js')
    assert.equal(a.status, 0)
    assert.equal(b.status, 0)
    assert.equal(a.stdout, b.stdout)
    assert.equal(a.stderr, '')
    assert.match(b.stderr, /openmail/)
  })
})
