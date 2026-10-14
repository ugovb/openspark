// Small, dependency-free HTML → Markdown converter (used by "Copy as Markdown").
// Keeps headings, bold/italic, links, lists, quotes, code, line breaks and paragraphs; everything
// else (images, tables, styling) is reduced to its text. Works on strings, so it also runs in Node.

interface El {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}
type Node = El | string

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col', 'area', 'base', 'source', 'track', 'embed', 'param'])
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'address', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'center', 'form', 'fieldset', 'dl', 'dt', 'dd', 'body', 'html',
])
const CLOSES_P = new Set([...BLOCK, 'ul', 'ol', 'li', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'])

// structural characters stay out of whitespace clean-up until the very end
const INDENT = '\u0001'
const QUOTE = '\u0002'

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®',
  trade: '™', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', euro: '€', zwnj: '', zwj: '',
}

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    const v = ENTITIES[e.toLowerCase()]
    return v === undefined ? m : v
  })
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

function parse(html: string): El {
  const src = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|title|head|noscript|template|xml)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!doctype[^>]*>/gi, '')
  const root: El = { tag: '#root', attrs: {}, children: [] }
  const stack: El[] = [root]
  const top = () => stack[stack.length - 1]
  const closeTo = (i: number) => {
    stack.length = i
  }
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|(<)/g
  for (const m of src.matchAll(re)) {
    if (m[4] !== undefined || m[5] !== undefined) {
      top().children.push(m[4] ?? m[5])
      continue
    }
    const tag = m[2].toLowerCase()
    if (m[1]) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          closeTo(i)
          break
        }
      }
      continue
    }
    if (top().tag === 'p' && CLOSES_P.has(tag)) stack.pop()
    if (tag === 'li') {
      // a new item closes the previous one of the same list
      for (let i = stack.length - 1; i > 0; i--) {
        const t = stack[i].tag
        if (t === 'ul' || t === 'ol') break
        if (t === 'li') {
          closeTo(i)
          break
        }
      }
    }
    const el: El = { tag, attrs: parseAttrs(m[3]), children: [] }
    top().children.push(el)
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(el)
  }
  return root
}

function rawText(n: Node): string {
  if (typeof n === 'string') return decode(n)
  if (n.tag === 'br') return '\n'
  return n.children.map(rawText).join('')
}

function escapeText(s: string): string {
  return s.replace(/([\\`*[\]])/g, '\\$1')
}

/** Trim spaces at line ends, drop runs of blank lines, trim the edges. */
function clean(s: string): string {
  return s
    .split('\n')
    .map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}

function wrapInline(inner: string, mark: string): string {
  const core = inner.trim()
  if (!core) return inner
  const lead = inner.match(/^\s*/)![0]
  const trail = inner.match(/\s*$/)![0]
  return `${lead}${mark}${core.replace(/\s*\n\s*/g, ' ')}${mark}${trail}`
}

function block(s: string): string {
  return s.trim() ? `\n\n${s}\n\n` : ''
}

function list(el: El): string {
  const ordered = el.tag === 'ol'
  let n = Number(el.attrs.start) || 1
  const items: string[] = []
  for (const c of el.children) {
    if (typeof c === 'string') {
      if (c.trim()) items.push(`- ${escapeText(decode(c).trim())}`)
      continue
    }
    if (c.tag !== 'li') {
      const inner = clean(render(c))
      if (inner) items.push(inner)
      continue
    }
    // tight lists: nested lists and paragraphs inside an item stay on consecutive lines
    const body = clean(children(c)).replace(/\n{2,}/g, '\n')
    const marker = ordered ? `${n++}.` : '-'
    const pad = INDENT.repeat(marker.length + 1)
    const lines = body.split('\n')
    items.push([`${marker} ${lines[0]}`, ...lines.slice(1).map((l) => (l ? pad + l : ''))].join('\n'))
  }
  return block(items.join('\n'))
}

function children(el: El): string {
  return el.children.map(render).join('')
}

function render(n: Node): string {
  if (typeof n === 'string') return escapeText(decode(n).replace(/\s+/g, ' '))
  switch (n.tag) {
    case 'br':
      return '\n'
    case 'hr':
      return '\n\n---\n\n'
    case 'img':
    case 'input':
    case 'select':
    case 'button':
      return ''
    case 'b':
    case 'strong':
      return wrapInline(children(n), '**')
    case 'i':
    case 'em':
    case 'cite':
      return wrapInline(children(n), '*')
    case 'code':
    case 'kbd':
    case 'samp': {
      const code = rawText(n).replace(/\s+/g, ' ')
      if (!code.trim()) return code
      const fence = code.includes('`') ? '``' : '`'
      return `${fence}${code}${fence}`
    }
    case 'pre': {
      const code = rawText(n).replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '')
      if (!code) return ''
      const lines = code.split('\n').map((l) => l.replace(/^[ \t]+/, (ws) => INDENT.repeat(ws.replace(/\t/g, '    ').length)))
      return `\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n\n`
    }
    case 'a': {
      const text = children(n)
      const href = (n.attrs.href || '').trim()
      if (!href || href.startsWith('#') || /^(javascript|data|vbscript):/i.test(href)) return text
      const label = text.replace(/\s+/g, ' ').trim()
      if (!label) return ''
      const url = href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
      const lead = text.match(/^\s*/)![0] ? ' ' : ''
      const trail = text.match(/\s*$/)![0] ? ' ' : ''
      return `${lead}[${label}](${url})${trail}`
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const text = children(n).replace(/\s+/g, ' ').trim()
      return text ? block(`${'#'.repeat(Number(n.tag[1]))} ${text}`) : ''
    }
    case 'ul':
    case 'ol':
      return list(n)
    case 'li':
      // an item outside a list
      return block(`- ${clean(children(n)).replace(/\n{2,}/g, '\n')}`)
    case 'blockquote': {
      const inner = clean(children(n))
      if (!inner) return ''
      return block(inner.split('\n').map((l) => (l ? `${QUOTE}${INDENT}${l}` : QUOTE)).join('\n'))
    }
    case 'td':
    case 'th':
      return `${children(n)} `
    default:
      if (BLOCK.has(n.tag)) return block(children(n))
      return children(n)
  }
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  const out = clean(render(parse(html)))
  return out.replace(/\u0001/g, ' ').replace(/\u0002/g, '>')
}
