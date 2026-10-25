// Every read of OCTO_* goes through env(): the OPENMAIL_* name wins, the old one still works.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))

describe('legacy environment names', () => {
  it('no source file reads process.env.OCTO_*', () => {
    const hits = walk(path.join(root, 'src'))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(path.join('shared', 'env.ts')))
      .filter((f) => /process\.env(\?\.|\.|\[')OCTO_/.test(fs.readFileSync(f, 'utf8')))
    assert.deepEqual(hits.map((f) => path.relative(root, f)), [])
  })
})
