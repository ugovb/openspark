// The docs must not carry retired names and must list the languages the app really ships.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const read = (f: string) => fs.readFileSync(f, 'utf8')
const DOCS = ['README.md', 'README_pl.md', 'SECURITY.md', 'CONTRIBUTING.md']

describe('docs', () => {
  it('no retired names in the docs', () => {
    for (const f of DOCS) {
      for (const bad of ['octo serve', 'OCTO_HOME', 'OCTO_SECRETS', '%APPDATA%\\Octopus Mail', '~/.config/Octopus Mail', 'exec octopus']) {
        assert.ok(!read(f).includes(bad), `${f}: ${bad}`)
      }
    }
  })
  it('the READMEs list all four languages', () => {
    for (const w of ['French', 'Spanish']) assert.match(read('README.md'), new RegExp(w))
    for (const w of ['francusk', 'hiszpańsk']) assert.match(read('README_pl.md'), new RegExp(w))
  })
})
