// "Send again" builds a new draft from a message that was already sent. Needs no mail server:
// the account, the sent message, its body and attachments are written straight into a temp database.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-send-again-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'
process.env.OPENMAIL_NO_AUTORUN = '1'

import { insert, now } from '../src/core/db'
import * as drafts from '../src/core/drafts'

let seq = 0
function seed(opts: { html?: string | null; text?: string | null; withAttachments?: boolean }) {
  const ts = now()
  const uniq = `${ts}-${++seq}` // two seeds in the same millisecond must not share an address
  const accountId =
    insert('accounts', { email: `me${uniq}@example.test`, name: 'Me', username: 'me', imap_host: 'imap.example.test', smtp_host: 'smtp.example.test', created_at: ts }) as number
  const folderId = insert('folders', { account_id: accountId, path: 'Sent', name: 'Sent', role: 'sent' }) as number
  const threadId = insert('threads', { account_id: accountId, subject: 'Quarterly report', last_date: ts }) as number
  const messageId = insert('messages', {
    account_id: accountId,
    folder_id: folderId,
    uid: 1,
    thread_id: threadId,
    msgid: '<orig@example.test>',
    subject: 'Quarterly report',
    from_name: 'Me',
    from_email: `me${uniq}@example.test`,
    to_json: JSON.stringify([{ name: 'Ann', email: 'ann@example.test' }]),
    cc_json: JSON.stringify([{ email: 'bob@example.test' }]),
    bcc_json: JSON.stringify([{ email: 'boss@example.test' }]),
    date: ts,
    is_outgoing: 1,
    body_state: 1,
    seen: 1,
    created_at: ts,
  }) as number
  insert('bodies', { message_id: messageId, html: opts.html ?? null, text: opts.text ?? null, fetched_at: ts })
  if (opts.withAttachments) {
    insert('attachments', { message_id: messageId, part: '2', filename: 'report.pdf', mime: 'application/pdf', size: 1234, inline: 0 })
    insert('attachments', { message_id: messageId, part: '3', filename: 'logo.png', mime: 'image/png', size: 50, inline: 1, content_id: 'logo' })
  }
  return { accountId, messageId, threadId, me: `me${uniq}@example.test` }
}

describe('send again', () => {
  it('copies recipients, subject, body and attachments into a new, unthreaded draft', () => {
    const s = seed({ html: '<div dir="auto"><p>Numbers attached.</p></div>', withAttachments: true })
    const d = drafts.sendAgainDraft(s.messageId)
    assert.equal(d.status, 'draft')
    assert.equal(d.account_id, s.accountId)
    assert.equal(d.from_email, s.me)
    assert.deepEqual(d.to.map((a) => a.email), ['ann@example.test'])
    assert.equal(d.to[0].name, 'Ann')
    assert.deepEqual(d.cc.map((a) => a.email), ['bob@example.test'])
    assert.deepEqual(d.bcc.map((a) => a.email), ['boss@example.test'])
    assert.equal(d.subject, 'Quarterly report')
    assert.equal(d.html, '<p>Numbers attached.</p>')
    // a new message, not a reply or forward in the old conversation
    assert.equal(d.thread_id, null)
    assert.equal(d.reply_to_message_id, null)
    assert.equal(d.forward_of_message_id, null)
    assert.equal(d.reply_kind, null)
    // regular attachments are referenced, inline images are left out
    assert.equal(d.attachments.length, 1)
    assert.equal(d.attachments[0].filename, 'report.pdf')
    assert.match(d.attachments[0].path, /^octo-att:\d+$/)
    assert.equal(d.attachments[0].mime, 'application/pdf')
  })

  it('turns a plain-text body into HTML', () => {
    const s = seed({ text: 'Line one\nLine two\n\nSecond <paragraph>' })
    const d = drafts.sendAgainDraft(s.messageId)
    assert.equal(d.html, '<p>Line one<br>Line two</p><p>Second &lt;paragraph&gt;</p>')
    assert.equal(d.signature, false)
    assert.deepEqual(d.attachments, [])
  })

  it('replaces the old signature with the current one', () => {
    const s = seed({ html: '<html><body><div dir="auto"><p>Hi Ann</p><div class="octo-signature"><br>-- <br>Old signature</div></div></body></html>' })
    const d = drafts.sendAgainDraft(s.messageId)
    assert.equal(d.signature, true)
    assert.ok(!d.html.includes('Old signature'), d.html)
    assert.ok(d.html.startsWith('<p>Hi Ann</p>'), d.html)
  })

  it('fails for a message that does not exist', () => {
    assert.throws(() => drafts.sendAgainDraft(999999))
  })
})
