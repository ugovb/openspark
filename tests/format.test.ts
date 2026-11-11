import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { escapeHtml, mdToHtml, plainToHtml } from '../src/renderer/src/lib/format'

describe('mdToHtml', () => {
  it('keeps quotes inside link targets', () => {
    const html = mdToHtml('see https://x.test/a"style="background:url(//evil.test/p)')
    assert.doesNotMatch(html, /href="[^"]*"style=/)
    assert.match(html, /href="https:\/\/x\.test\/a&quot;style=&quot;background:url\(\/\/evil\.test\/p\)"/)
  })
  it('escapes quotes in plain text', () => {
    assert.equal(mdToHtml(`it's "fine"`), '<p>it&#39;s &quot;fine&quot;</p>')
  })
  it('still links message references', () => {
    assert.equal(mdToHtml('see [#12]'), '<p>see <a href="#msg-12" data-msg="12">[#12]</a></p>')
  })
})

describe('escapeHtml / plainToHtml', () => {
  it('escapes the five HTML characters', () => assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'))
  it('plainToHtml escapes quotes', () => assert.ok(plainToHtml('a "b"').includes('&quot;b&quot;')))
})
