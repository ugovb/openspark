// Non-persisted `octo` identifiers were renamed to `openmail`. Markers written into mails and drafts stay (see ALLOWED).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))

// Persisted in mails and drafts: old messages must stay readable.
const ALLOWED = new Set(['octo-quote', 'octo-att', 'octo-signature'])
// Legacy session names, read only by the server session module.
const SESSION_FILE = path.join('src', 'server', 'web-session.ts')
const SESSION_ONLY = /^(octo_token|x-octo)$/i

describe('octo identifiers', () => {
  it('are gone from src (except persisted markers and the legacy session names)', () => {
    const offenders: string[] = []
    for (const f of walk(path.join(root, 'src')).filter((x) => /\.(ts|tsx|css|html)$/.test(x))) {
      const rel = path.relative(root, f)
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const hits = [...(line.match(/\bocto(?:[-_][a-z0-9]+(?:-[a-z0-9]+)*|[A-Z]\w*)|_octo\w*/g) ?? []), ...(line.match(/x-octo\b/gi) ?? [])]
        for (const h of hits) {
          if (ALLOWED.has(h)) continue
          if (rel === SESSION_FILE && SESSION_ONLY.test(h)) continue
          offenders.push(`${rel}:${i + 1}: ${h}`)
        }
      })
    }
    assert.deepEqual(offenders, [])
  })
})
