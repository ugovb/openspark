// The renderer talks to the app through window.openmail; window.octo no longer exists.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))

describe('window.octo', () => {
  it('is not used by the renderer', () => {
    const hits = walk(path.join(root, 'src', 'renderer'))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => /window\.octo\b/.test(fs.readFileSync(f, 'utf8')))
    assert.deepEqual(hits.map((f) => path.relative(root, f)), [])
  })
  it('the preload does not expose window.octo', () => {
    assert.ok(!fs.readFileSync(path.join(root, 'src', 'preload', 'index.ts'), 'utf8').includes("exposeInMainWorld('octo'"))
  })
})
