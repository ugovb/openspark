import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const RENDERER = join(process.cwd(), 'src', 'renderer', 'src')
const css = readFileSync(join(RENDERER, 'index.css'), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(selector + ' {')
  assert.ok(start >= 0, `missing ${selector} block`)
  return css.slice(start, css.indexOf('\n}', start))
}
function tokens(src: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of src.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase()
  return out
}
const light = tokens(block(':root'))
const dark = { ...light, ...tokens(block('[data-theme="dark"]')) }

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEXT = ['text', 'muted', 'faint', 'accent', 'danger', 'success', 'warning']
const SURFACES = ['bg', 'panel', 'surface', 'surface-2', 'hover', 'row-hover']
const PAIRS: [fg: string, bg: string, min: number][] = [
  ...TEXT.flatMap((f) => SURFACES.map((b) => [f, b, 4.5] as [string, string, number])),
  ['accent', 'accent-soft', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['danger-fg', 'danger', 4.5],
  ['rail-fg', 'rail', 4.5], ['rail-fg', 'rail-2', 4.5], ['rail-faint', 'rail', 4.5], ['rail-faint', 'rail-2', 4.5],
  ['rail-warning', 'rail', 4.5], ['rail-warning', 'rail-2', 4.5], ['rail-danger', 'rail', 4.5], ['rail-danger', 'rail-2', 4.5],
  ...['pin', 'people', 'notification', 'newsletter'].flatMap((f) => SURFACES.map((b) => [f, b, 3] as [string, string, number])),
]

function failures(theme: Record<string, string>): string[] {
  const bad: string[] = []
  for (const [fg, bg, min] of PAIRS) {
    if (!theme[fg] || !theme[bg]) { bad.push(`${fg} on ${bg} missing token`); continue }
    const r = ratio(theme[fg], theme[bg])
    if (r < min) bad.push(`${fg} on ${bg} ${r.toFixed(2)} (min ${min})`)
  }
  return bad
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : []
  })
}

describe('colour contrast', () => {
  it('dark block defines its own values for the key tokens', () => {
    const own = tokens(block('[data-theme="dark"]'))
    for (const n of ['accent-fg', 'danger-fg', 'muted', 'faint', 'accent', 'danger', 'rail-faint']) assert.ok(own[n], `dark block lacks --${n}`)
  })
  it('light theme meets WCAG AA', () => {
    const bad = failures(light)
    assert.deepEqual(bad, [], 'light:\n' + bad.map((b) => 'light ' + b).join('\n'))
  })
  it('dark theme meets WCAG AA', () => {
    const bad = failures(dark)
    assert.deepEqual(bad, [], 'dark:\n' + bad.map((b) => 'dark ' + b).join('\n'))
  })
  it('danger buttons use the danger-fg token', () => {
    const re = /bg-danger[^"'`]*text-white|text-white[^"'`]*bg-danger/
    const hits = tsxFiles(RENDERER).filter((f) => re.test(readFileSync(f, 'utf8')))
    assert.deepEqual(hits, [])
  })
})
