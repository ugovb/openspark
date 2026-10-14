// HTML → Markdown converter behind "Copy as Markdown" (pure string code, no mail server needed).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { htmlToMarkdown as md } from '../src/renderer/src/lib/markdown'

describe('htmlToMarkdown', () => {
  it('turns paragraphs and line breaks into text blocks', () => {
    assert.equal(md('<p>Hello Ann,</p><p>first line<br>second line</p>'), 'Hello Ann,\n\nfirst line\nsecond line')
    assert.equal(md('<div>one</div><div>two</div>'), 'one\n\ntwo')
    assert.equal(md('<p>  lots   of\n   space </p>'), 'lots of space')
  })

  it('keeps headings, bold and italic', () => {
    assert.equal(md('<h1>Title</h1><h3>Sub <b>part</b></h3>'), '# Title\n\n### Sub **part**')
    assert.equal(md('<p>This is <strong>very</strong> <em>important</em>.</p>'), 'This is **very** *important*.')
    assert.equal(md('<p>a<b> spaced </b>b</p>'), 'a **spaced** b')
    assert.equal(md('<p><b></b>empty</p>'), 'empty')
  })

  it('writes links', () => {
    assert.equal(md('<p>See <a href="https://example.com/a b">the docs</a> now</p>'), 'See [the docs](https://example.com/a%20b) now')
    assert.equal(md('<a href="https://x.test/(1)">x</a>'), '[x](https://x.test/%281%29)')
    assert.equal(md('<a href="javascript:alert(1)">click</a>'), 'click')
    assert.equal(md('<a href="#top">top</a>'), 'top')
    assert.equal(md('<a href="https://x.test"><img src="a.png"></a>'), '')
  })

  it('writes bulleted, numbered and nested lists', () => {
    assert.equal(md('<ul><li>one</li><li>two</li></ul>'), '- one\n- two')
    assert.equal(md('<ol start="3"><li>three<li>four</ol>'), '3. three\n4. four')
    assert.equal(md('<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>'), '- parent\n  - child\n- next')
    assert.equal(md('<p>Before</p><ul><li><p>para item</p></li></ul><p>After</p>'), 'Before\n\n- para item\n\nAfter')
  })

  it('quotes blockquotes, also nested ones', () => {
    assert.equal(md('<blockquote><p>quoted</p><p>more</p></blockquote>'), '> quoted\n>\n> more')
    assert.equal(md('<p>Reply</p><blockquote>outer<blockquote>inner</blockquote></blockquote>'), 'Reply\n\n> outer\n>\n> > inner')
  })

  it('keeps code and pre blocks', () => {
    assert.equal(md('<p>Run <code>npm test</code></p>'), 'Run `npm test`')
    assert.equal(md('<pre>  indented\nline *2*</pre>'), '```\n  indented\nline *2*\n```')
  })

  it('strips everything else and decodes entities', () => {
    assert.equal(
      md('<html><head><style>p{color:red}</style><title>x</title></head><body><!-- c --><script>alert(1)</script><p style="color:red">Tom &amp; Jerry&nbsp;&#8211; &lt;3 &#x1F600;</p><img src="x.png"><span>end</span></body></html>'),
      'Tom & Jerry – <3 😀\n\nend',
    )
    assert.equal(md('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>'), 'a b\n\nc')
    assert.equal(md('<p>5 * 3 = [15]</p>'), '5 \\* 3 = \\[15\\]')
    assert.equal(md('<hr>'), '---')
    assert.equal(md(''), '')
  })

  it('tolerates broken markup', () => {
    assert.equal(md('<p>one<p>two</div></span>three'), 'one\n\ntwothree')
    assert.equal(md('a < b and <b>c'), 'a < b and **c**')
  })
})
