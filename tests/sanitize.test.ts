import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { looksLikeHtml, previewHtml, sanitizeFragment } from '../src/renderer/src/lib/sanitize'

before(() => {
  const { window } = new JSDOM('')
  Object.assign(globalThis, { window, document: window.document })
})

describe('sanitizeFragment', () => {
  it('drops scripts and handlers, keeps formatting', () =>
    assert.equal(sanitizeFragment('<b onclick="x()">Hi</b><script>alert(1)</script>'), '<b>Hi</b>'))
  it('keeps links and images', () =>
    assert.equal(sanitizeFragment('<a href="https://a.test">a</a><img src="https://a.test/l.png">'), '<a href="https://a.test">a</a><img src="https://a.test/l.png">'))
  it('drops javascript: links', () => assert.equal(sanitizeFragment('<a href="javascript:alert(1)">x</a>'), '<a>x</a>'))
})

describe('previewHtml', () => {
  it('shows plain text with an address as text', () =>
    assert.equal(previewHtml('Ugo <ugo@x.test>\nCEO'), 'Ugo &lt;ugo@x.test&gt;<br>CEO'))
  it('treats real markup as HTML', () => {
    assert.equal(looksLikeHtml('<p>Hi</p>'), true)
    assert.equal(looksLikeHtml('Ugo <ugo@x.test>'), false)
    assert.equal(previewHtml('<p onmouseover="x()">Hi</p>'), '<p>Hi</p>')
  })
})
