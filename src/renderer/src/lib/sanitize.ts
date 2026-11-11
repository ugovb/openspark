import DOMPurify from 'dompurify'
import { escapeHtml } from './format'

type Purifier = ReturnType<typeof DOMPurify>
let purifier: Purifier | null = null

/** Strip scripts, handlers and form-like elements from an HTML fragment. */
export function sanitizeFragment(html: string): string {
  purifier ??= DOMPurify(window)
  return purifier.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'meta', 'link', 'base'],
    FORBID_ATTR: ['formaction', 'action', 'ping']
  })
}

const HTML_TAG = /<\/?(p|div|br|span|a|b|i|u|strong|em|img|table|tr|td|font|ul|ol|li|h[1-6]|hr|blockquote|small|center|pre|code|sub|sup|s|strike|del|ins|mark)\b[^>]*>/i

export function looksLikeHtml(s: string): boolean {
  return HTML_TAG.test(s)
}

export function previewHtml(s: string): string {
  return looksLikeHtml(s) ? sanitizeFragment(s) : escapeHtml(s).replace(/\r?\n/g, '<br>')
}
