// Conversation actions shared by the command palette, the list's context menu and the thread view:
// send again, print, copy link / Markdown / hyperlink, search & group by sender, open in a new window.
import { AppWindow, FileText, Group, Link, Link2, Printer, Repeat, UserSearch } from 'lucide-react'
import type { Address, MessageView, ThreadSummary, ThreadView } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import { mailCsp, sanitizeMail } from '../components/MessageFrame'
import type { MenuItem } from '../components/ui'
import { api, errorText } from './api'
import { displayName, fileSize, fullDate } from './format'
import { htmlToMarkdown } from './markdown'
import { useStore } from './store'

type ThreadRef = Pick<ThreadSummary, 'thread_id' | 'subject' | 'from' | 'outgoing_last'>

function fail(e: unknown): void {
  useStore.getState().toast({ level: 'error', message: errorText(e) })
}

function done(message: string): void {
  useStore.getState().toast({ level: 'success', message })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The conversation with every message body downloaded. */
export async function loadFullThread(threadId: number): Promise<ThreadView> {
  let tv = await api.getThread(threadId)
  if (!tv) throw new Error(t('This conversation no longer exists'))
  if (tv.messages.some((m) => m.body_state !== 1)) tv = (await api.fetchThreadBodies(threadId)) || tv
  return tv
}

/** Link that opens the conversation: the app's own protocol on the desktop, a URL in the browser version. */
export function threadLink(threadId: number): string {
  return window.__OCTO_WEB__ ? `${location.origin}/#/thread/${threadId}` : `openmail://thread/${threadId}`
}

/** Copy text (and optionally an HTML flavour); works on plain-HTTP pages where the async clipboard is missing. */
export async function copyText(text: string, html?: string): Promise<void> {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) }),
      ])
      return
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    /* fall back to the selection-based copy */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error(t('Couldn’t copy to the clipboard'))
}

function addressLine(list: Address[]): string {
  return list.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', ')
}

/** Self-contained, sanitized document for printing a conversation (no scripts, no remote content). */
export function threadPrintHtml(tv: ThreadView): string {
  const subject = tv.thread.subject || t('(no subject)')
  const messages = tv.messages.map((m) => {
    const files = m.attachments.filter((a) => !a.inline)
    const meta = [
      m.to.length ? `<div><b>${esc(t('To:'))}</b> ${esc(addressLine(m.to))}</div>` : '',
      m.cc.length ? `<div><b>${esc(t('Cc:'))}</b> ${esc(addressLine(m.cc))}</div>` : '',
    ].join('')
    return `<section class="msg">
<div class="head"><span><b>${esc(displayName(m.from))}</b> &lt;${esc(m.from.email)}&gt;</span><span class="date">${esc(fullDate(m.date))}</span></div>
<div class="meta">${meta}</div>
<div class="body">${sanitizeMail(m, false, true, 'remove').html}</div>
${files.length ? `<div class="files">📎 ${files.map((a) => `${esc(a.filename)} (${esc(fileSize(a.size))})`).join(', ')}</div>` : ''}
</section>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${mailCsp(false)}">
<title>${esc(subject)}</title>
<style>
@page{margin:16mm;}
html,body{margin:0;background:#fff;color:#111;}
body{font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;font-size:12.5px;line-height:1.5;overflow-wrap:anywhere;}
h1{font-size:18px;margin:0 0 12px;}
.msg{border-top:1px solid #bbb;padding:10px 0 14px;break-inside:auto;}
.head{display:flex;justify-content:space-between;gap:12px;}
.date,.meta,.files{color:#555;font-size:11.5px;}
.body{margin-top:8px;}
img{max-width:100%;height:auto;}
table{max-width:100%;}
pre{white-space:pre-wrap;}
a{color:#111;}
blockquote{margin:6px 0 6px 2px;border-left:3px solid #ccc;padding-left:10px;color:#555;}
details.octo-q{display:none;}
</style></head><body><h1>${esc(subject)}</h1>${messages.join('\n')}</body></html>`
}

function messageMarkdown(m: MessageView): string {
  return htmlToMarkdown(sanitizeMail(m, false, true, 'remove').html)
}

/** The conversation as Markdown: subject, then every message with its sender and date. */
export function threadMarkdown(tv: ThreadView): string {
  const parts = [`# ${tv.thread.subject || t('(no subject)')}`]
  for (const m of tv.messages) {
    parts.push(`**${displayName(m.from)}** <${m.from.email}> · ${fullDate(m.date)}`, messageMarkdown(m) || '_' + t('(no content)') + '_')
    if (m !== tv.messages[tv.messages.length - 1]) parts.push('---')
  }
  return parts.join('\n\n')
}

export async function printThread(threadId: number): Promise<void> {
  try {
    await window.octo.printHtml(threadPrintHtml(await loadFullThread(threadId)))
  } catch (e) {
    fail(e)
  }
}

export async function copyThreadLink(threadId: number): Promise<void> {
  try {
    await copyText(threadLink(threadId))
    done(t('Link copied'))
  } catch (e) {
    fail(e)
  }
}

export async function copyThreadMarkdown(threadId: number): Promise<void> {
  try {
    await copyText(threadMarkdown(await loadFullThread(threadId)))
    done(t('Copied as Markdown'))
  } catch (e) {
    fail(e)
  }
}

/** Markdown link [subject](link), with an HTML link for apps that paste rich text. */
export async function copyThreadHyperlink(th: Pick<ThreadSummary, 'thread_id' | 'subject'>): Promise<void> {
  const link = threadLink(th.thread_id)
  const subject = th.subject || t('(no subject)')
  try {
    await copyText(`[${subject.replace(/([\\[\]])/g, '\\$1')}](${link})`, `<a href="${esc(link)}">${esc(subject)}</a>`)
    done(t('Link copied'))
  } catch (e) {
    fail(e)
  }
}

export function searchBySender(email: string): void {
  useStore.getState().setMailbox({ kind: 'search', query: `from:${email}` })
}

/** A smart folder for everything from this sender (reused when it already exists), then open it. */
export async function groupBySender(from: Address): Promise<void> {
  const query = `from:${from.email}`
  try {
    const st = useStore.getState()
    let id = st.smartFolders.find((sf) => sf.query.trim().toLowerCase() === query.toLowerCase())?.id
    if (!id) {
      const name = from.name || from.email
      id = await api.saveSmartFolder({ name, query })
      await st.refreshMeta()
      done(t('Smart folder “{name}” created', { name }))
    }
    useStore.getState().setMailbox({ kind: 'smartfolder', id })
  } catch (e) {
    fail(e)
  }
}

export function openInNewWindow(threadId: number): void {
  void window.octo.openThreadWindow(threadId).catch(fail)
}

/** "Send again" fits conversations whose last message is ours, or anything opened from Sent. */
export function canSendAgain(th: Pick<ThreadSummary, 'outgoing_last'>): boolean {
  if (th.outgoing_last) return true
  const { mailbox, folders } = useStore.getState()
  if (mailbox.kind === 'unified') return mailbox.role === 'sent'
  if (mailbox.kind === 'folder') return folders.find((f) => f.id === mailbox.folderId)?.role === 'sent'
  return false
}

/** Open a new composer copying a sent message (by default the latest one we sent in the conversation). */
export async function sendAgain(threadId: number, messageId?: number): Promise<void> {
  try {
    let id = messageId
    if (!id) id = (await api.getThread(threadId))?.messages.filter((m) => m.is_outgoing).pop()?.id
    if (!id) throw new Error(t('There is no sent message in this conversation'))
    useStore.getState().compose({ mode: 'again', messageId: id, inline: false })
  } catch (e) {
    fail(e)
  }
}

/** Menu entries for the extra conversation actions (context menu, "More" menu). */
export function extraThreadItems(th: ThreadRef): MenuItem[] {
  const standalone = useStore.getState().standalone
  return [
    ...(canSendAgain(th) ? [{ label: t('Send again'), icon: <Repeat size={14} />, onClick: () => void sendAgain(th.thread_id) }] : []),
    { label: t('Print…'), icon: <Printer size={14} />, onClick: () => void printThread(th.thread_id) },
    { label: t('Copy link'), icon: <Link size={14} />, onClick: () => void copyThreadLink(th.thread_id) },
    { label: t('Copy as Markdown'), icon: <FileText size={14} />, onClick: () => void copyThreadMarkdown(th.thread_id) },
    { label: t('Copy hyperlink to this conversation'), icon: <Link2 size={14} />, onClick: () => void copyThreadHyperlink(th) },
    // a conversation window has no list to show results in
    ...(standalone ? [] : [
      { label: t('Search emails by sender'), icon: <UserSearch size={14} />, onClick: () => searchBySender(th.from.email) },
      { label: t('Group emails by sender'), icon: <Group size={14} />, onClick: () => void groupBySender(th.from) },
      { label: t('Open in a new window'), icon: <AppWindow size={14} />, onClick: () => openInNewWindow(th.thread_id) },
    ]),
  ]
}
