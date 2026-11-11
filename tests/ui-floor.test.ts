import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const RENDERER = join(process.cwd(), 'src', 'renderer', 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

describe('ui floor', () => {
  it('no text below 11.5px in the renderer', () => {
    const offenders: string[] = []
    for (const f of walk(RENDERER)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
          if (parseFloat(m[1]) < 11.5) offenders.push(`${f.slice(process.cwd().length + 1)}:${i + 1} ${m[0]}`)
        }
      })
    }
    assert.deepEqual(offenders, [], `text below 11.5px:\n${offenders.join('\n')}`)
  })

  it('mail bodies and print use the shared font stack', () => {
    for (const f of ['src/renderer/src/components/MessageFrame.tsx', 'src/renderer/src/lib/thread-actions.tsx']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      assert.doesNotMatch(src, /font-family:"Segoe UI Variable Text"/, f)
      assert.match(src, /MAIL_FONT/, f)
    }
  })
})
