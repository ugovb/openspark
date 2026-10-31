// Mail rules engine: condition matching and groups. No mail server needed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

process.env.OPENMAIL_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmail-rules-'))
process.env.OPENMAIL_SECRETS = 'memory'
process.env.OPENMAIL_QUIET = '1'
process.env.OPENMAIL_NO_AUTORUN = '1'

import type { Row } from '../src/core/db'
import { all, get, insert, now, run } from '../src/core/db'
import { applyRuleToExisting, listRules, previewRule, processNewMessages, requiredAccess, ruleMatches, runDueScheduledRules, saveRule, scanInbox, validateConditions, validateRule } from '../src/core/rules'
import { lastOccurrence } from '../src/shared/rules'
import { AccessError, createService } from '../src/core/service'
import type { Rule, RuleCondition, RuleNode } from '../src/shared/types'

function msg(o: Row = {}): Row {
  return {
    id: 1, thread_id: 1, account_id: 1, subject: 'Invoice 42', from_name: 'Bob', from_email: 'bob@shop.test',
    to_json: '[]', cc_json: '[]', category: 'people', has_attachments: 0, list_id: null, snippet: '', date: Date.now(), ...o,
  }
}
const c = (field: RuleCondition['field'], op: RuleCondition['op'], value: string): RuleCondition => ({ field, op, value })
const rule = (match: 'all' | 'any', conditions: RuleNode[]): Rule =>
  ({ id: 1, name: 'r', enabled: true, match, conditions, actions: [], stop: false, sort: 0, hits: 0 })

describe('rule condition groups', () => {
  it('rules saved before groups still match', () => {
    const flat = [c('subject', 'contains', 'invoice'), c('from', 'contains', 'bob')]
    assert.equal(ruleMatches(rule('all', flat), msg()), true)
    const anyRule = [c('subject', 'contains', 'nope'), c('from', 'contains', 'bob')]
    assert.equal(ruleMatches(rule('any', anyRule), msg()), true)
  })

  it('an any-group inside an all-rule', () => {
    const r = rule('all', [
      c('from', 'contains', 'bob'),
      { group: 'any', items: [c('subject', 'contains', 'invoice'), c('subject', 'contains', 'receipt')] },
    ])
    assert.equal(ruleMatches(r, msg({ subject: 'Receipt' })), true)
    assert.equal(ruleMatches(r, msg({ subject: 'Hello' })), false)
  })

  it('a none-group excludes', () => {
    const r = rule('all', [{ group: 'none', items: [c('subject', 'contains', 'spam')] }])
    assert.equal(ruleMatches(r, msg({ subject: 'Hello' })), true)
    assert.equal(ruleMatches(r, msg({ subject: 'Spam offer' })), false)
  })

  it('an invalid regex is false, not an error', () => {
    assert.equal(ruleMatches(rule('all', [c('subject', 'matches', '(')]), msg()), false)
  })

  it('validateConditions limits', () => {
    const leaf = c('subject', 'contains', 'x')
    assert.throws(() => validateConditions([{ group: 'any', items: [] }]))
    const deep4: RuleNode = { group: 'all', items: [{ group: 'all', items: [{ group: 'all', items: [{ group: 'all', items: [leaf] }] }] }] }
    assert.throws(() => validateConditions([deep4]))
    assert.throws(() => validateConditions(Array.from({ length: 21 }, () => leaf)))
    const deep3: RuleNode = { group: 'all', items: [{ group: 'any', items: [{ group: 'none', items: Array.from({ length: 20 }, () => leaf) }] }] }
    assert.doesNotThrow(() => validateConditions([deep3]))
  })
})

describe('rule age condition', () => {
  const DAY = 86_400_000
  const aged = (field: 'greater_than' | 'less_than', v: string, date: number | null = Date.now() - 7 * DAY - 1000) =>
    ruleMatches(rule('all', [c('age_days', field, v)]), msg({ date }))

  it('compares message age in days', () => {
    assert.equal(aged('greater_than', '7'), true)
    assert.equal(aged('less_than', '7'), false)
    assert.equal(aged('greater_than', '6'), true)
  })

  it('a non-numeric value or a missing date never matches', () => {
    assert.equal(aged('greater_than', 'abc'), false)
    assert.equal(aged('greater_than', '7', null), false)
    assert.equal(aged('less_than', '7', null), false)
  })

  it('validateConditions checks the age value', () => {
    assert.throws(() => validateConditions([c('age_days', 'greater_than', '-1')]))
    assert.throws(() => validateConditions([c('age_days', 'greater_than', '1.5x')]))
    assert.doesNotThrow(() => validateConditions([c('age_days', 'greater_than', '0')]))
    assert.doesNotThrow(() => validateConditions([c('age_days', 'less_than', '30')]))
  })
})

let seq = 0
function seedMessage(o: { subject: string; fromEmail: string; ageDays?: number; thread?: number; accountId?: number }) {
  const ts = now()
  const accountId =
    o.accountId ?? (insert('accounts', { email: `rules${ts}-${++seq}@example.test`, name: 'Me', username: 'me', imap_host: 'imap.example.test', smtp_host: 'smtp.example.test', created_at: ts }) as number)
  const folder = get<{ id: number }>("SELECT id FROM folders WHERE account_id = ? AND role = 'inbox'", accountId)
  const folderId = folder?.id ?? (insert('folders', { account_id: accountId, path: 'INBOX', name: 'INBOX', role: 'inbox' }) as number)
  const date = ts - (o.ageDays ?? 0) * 86_400_000
  const threadId = o.thread ?? (insert('threads', { account_id: accountId, subject: o.subject, last_date: date }) as number)
  const messageId = insert('messages', {
    account_id: accountId, folder_id: folderId, uid: ++seq, thread_id: threadId, msgid: `<r${seq}@example.test>`, subject: o.subject,
    from_name: 'Sender', from_email: o.fromEmail, to_json: '[]', cc_json: '[]', date, is_outgoing: 0, body_state: 1, seen: 1, created_at: ts,
  }) as number
  return { accountId, threadId, messageId }
}
const thread = (id: number) => get<{ done_at: number | null; priority: number }>('SELECT done_at, priority FROM threads WHERE id = ?', id)!
const hits = (id: number) => get<{ hits: number }>('SELECT hits FROM rules WHERE id = ?', id)!.hits
const byFrom = (email: string): RuleNode[] => [c('from', 'equals', email)]

describe('rule preview and apply', () => {
  it('preview counts a conversation once', () => {
    const a = seedMessage({ subject: 'pv-once', fromEmail: 'pv-once@x.test' })
    seedMessage({ subject: 'pv-once re', fromEmail: 'pv-once@x.test', thread: a.threadId, accountId: a.accountId })
    const p = previewRule({ match: 'all', conditions: byFrom('pv-once@x.test'), actions: [] })
    assert.equal(p.matchedThreads, 1)
    assert.equal(p.sample.length, 1)
    assert.equal(p.sample[0].threadId, a.threadId)
  })

  it('preview reports truncation', () => {
    // the database is shared with other tests: hide everything else so the scan sees only these 5 rows
    const others = all('SELECT id FROM messages WHERE hidden = 0').map((r) => r.id as number)
    run('UPDATE messages SET hidden = 1 WHERE hidden = 0')
    try {
      const acc = seedMessage({ subject: 'pv-trunc-0', fromEmail: 'pv-trunc@x.test' }).accountId
      for (let i = 1; i < 5; i++) seedMessage({ subject: `pv-trunc-${i}`, fromEmail: 'pv-trunc@x.test', accountId: acc })
      const conds = byFrom('pv-trunc@x.test')
      const p3 = previewRule({ match: 'all', conditions: conds, actions: [] }, 3)
      assert.equal(p3.scanned, 3)
      assert.equal(p3.truncated, true)
      const p5 = previewRule({ match: 'all', conditions: conds, actions: [] }, 5)
      assert.equal(p5.scanned, 5)
      assert.equal(p5.truncated, false)
    } finally {
      for (const id of others) run('UPDATE messages SET hidden = 0 WHERE id = ?', id)
    }
  })

  it('apply archives matches and reports the result', () => {
    const a = seedMessage({ subject: 'ap-1', fromEmail: 'ap@x.test' })
    const b = seedMessage({ subject: 'ap-2', fromEmail: 'ap@x.test', accountId: a.accountId })
    const r = saveRule({ name: 'ap-rule', conditions: byFrom('ap@x.test'), actions: [{ type: 'archive' }] })
    assert.deepEqual(applyRuleToExisting(r.id, 50000), { matched: 2, applied: 2, truncated: false })
    assert.notEqual(thread(a.threadId).done_at, null)
    assert.notEqual(thread(b.threadId).done_at, null)
    assert.equal(hits(r.id), 2)
    const h = all("SELECT * FROM history WHERE actor = 'rule' AND action = 'rule-applied' AND target IN (?, ?)", String(a.messageId), String(b.messageId))
    assert.equal(h.length, 2)
  })

  it('priority action', () => {
    const a = seedMessage({ subject: 'pr-1', fromEmail: 'pr@x.test' })
    const r = saveRule({ name: 'pr-rule', conditions: byFrom('pr@x.test'), actions: [{ type: 'priority' }] })
    applyRuleToExisting(r.id, 50000)
    assert.equal(thread(a.threadId).priority, 1)
  })

  it('a stored forward action is skipped', () => {
    const a = seedMessage({ subject: 'fw-1', fromEmail: 'fw@x.test' })
    const r = saveRule({ name: 'fw-rule', conditions: byFrom('fw@x.test'), actions: [{ type: 'archive' }] })
    run('UPDATE rules SET actions = ? WHERE id = ?', '[{"type":"forward","value":"x@y.test"},{"type":"archive"}]', r.id)
    assert.doesNotThrow(() => applyRuleToExisting(r.id, 50000))
    assert.notEqual(thread(a.threadId).done_at, null)
  })
})

describe('rule validation hardening', () => {
  const leaf = c('subject', 'contains', 'x')
  it('rejects an unknown group value and missing items', () => {
    assert.throws(() => validateConditions([{ group: 'xor', items: [leaf] } as unknown as RuleNode]), /group/i)
    assert.throws(() => validateConditions([{ group: 'all' } as unknown as RuleNode]), (e: Error) => e instanceof Error && !(e instanceof TypeError))
  })
  it('rejects invalid field/op pairs', () => {
    assert.throws(() => validateConditions([c('age_days', 'contains', 'x')]))
    assert.throws(() => validateConditions([c('subject', 'greater_than', '3')]))
    assert.throws(() => validateConditions([{ group: 'none', items: [c('age_days', 'contains', '3')] }]))
    assert.doesNotThrow(() => validateConditions([{ group: 'none', items: [c('age_days', 'greater_than', '3')] }]))
  })
  it('less_than matches a message younger than the limit', () => {
    const d = Date.now() - 7 * 86_400_000
    assert.equal(ruleMatches(rule('all', [c('age_days', 'less_than', '8')]), msg({ date: d })), true)
  })
})

describe('truncation of apply to existing', () => {
  it('reports truncated only when more messages exist than the limit', () => {
    const a = seedMessage({ subject: 'tr-1', fromEmail: 'tr-unique@x.test' })
    seedMessage({ subject: 'tr-2', fromEmail: 'tr-unique@x.test', accountId: a.accountId })
    const r = saveRule({ name: 'tr-rule', conditions: byFrom('tr-unique@x.test'), actions: [] })
    const total = scanInbox(1_000_000).length
    assert.equal(applyRuleToExisting(r.id, total).truncated, false)
    assert.equal(applyRuleToExisting(r.id, total - 1).truncated, true)
  })
})

describe('rule schedules', () => {
  const at = (s: string) => new Date(s).getTime()
  const daily = { at: '09:00', days: [] as number[] }

  it('lastOccurrence finds the latest scheduled time', () => {
    assert.equal(lastOccurrence(daily, at('2026-10-30T10:00')), at('2026-10-30T09:00'))
    assert.equal(lastOccurrence(daily, at('2026-10-30T08:00')), at('2026-10-29T09:00'))
    assert.equal(lastOccurrence({ at: '09:00', days: [1] }, at('2026-10-30T10:00')), at('2026-10-26T09:00'))
  })

  it('schema has the new columns', () => {
    const cols = all('PRAGMA table_info(rules)').map((r) => r.name)
    assert.ok(cols.includes('schedule'))
    assert.ok(cols.includes('last_run_at'))
  })

  it('saving a schedule starts the clock', () => {
    const r = saveRule({ name: 'sc-clock', conditions: byFrom('sc-clock@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    assert.ok(r.lastRunAt != null && Math.abs(r.lastRunAt - Date.now()) < 1000)
    run('UPDATE rules SET last_run_at = 12345 WHERE id = ?', r.id)
    const r2 = saveRule({ ...r, name: 'sc-clock2' })
    assert.equal(r2.lastRunAt, 12345)
    const r3 = saveRule({ ...r2, schedule: { at: '10:00', days: [] } })
    assert.ok(r3.lastRunAt != null && Math.abs(r3.lastRunAt - Date.now()) < 1000)
  })

  const setup = (email: string, enabled = true) => {
    const a = seedMessage({ subject: `${email}-1`, fromEmail: email })
    const b = seedMessage({ subject: `${email}-2`, fromEmail: email, accountId: a.accountId })
    const c3 = seedMessage({ subject: `${email}-3`, fromEmail: email, accountId: a.accountId })
    const r = saveRule({ name: email, conditions: byFrom(email), actions: [{ type: 'archive' }], schedule: daily, enabled })
    run('UPDATE rules SET last_run_at = ? WHERE id = ?', at('2026-10-27T09:00'), r.id)
    return { r, threads: [a.threadId, b.threadId, c3.threadId], accountId: a.accountId, messageId: a.messageId }
  }

  it('catch-up runs once', () => {
    const { r, threads } = setup('sc-catch@x.test')
    const out = runDueScheduledRules(at('2026-10-30T10:00')).filter((x) => x.ruleId === r.id)
    assert.deepEqual(out, [{ ruleId: r.id, applied: 3 }])
    for (const t of threads) assert.notEqual(thread(t).done_at, null)
    assert.deepEqual(runDueScheduledRules(at('2026-10-30T10:00')).filter((x) => x.ruleId === r.id), [])
    const h = all("SELECT * FROM history WHERE action = 'rule-scheduled' AND target = ?", String(r.id))
    assert.equal(h.length, 1)
  })

  it('disabled and fresh rules do not run', () => {
    const { r } = setup('sc-off@x.test', false)
    assert.deepEqual(runDueScheduledRules(at('2026-10-30T10:00')).filter((x) => x.ruleId === r.id), [])
    const fresh = saveRule({ name: 'sc-fresh', conditions: byFrom('sc-fresh@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    assert.deepEqual(runDueScheduledRules(fresh.lastRunAt!).filter((x) => x.ruleId === fresh.id), [])
  })

  it('scheduled rules ignore new mail', () => {
    const { r, messageId, accountId } = setup('sc-new@x.test')
    const before = hits(r.id)
    processNewMessages(accountId, [messageId], false)
    assert.equal(hits(r.id), before)
  })

  it('validateRule and requiredAccess', () => {
    const base = { conditions: byFrom('v@x.test'), actions: [{ type: 'archive' as const }], schedule: null }
    assert.throws(() => validateRule({ ...base, actions: [{ type: 'snooze' }], schedule: daily }))
    assert.throws(() => validateRule({ ...base, schedule: { at: '25:00', days: [] } }))
    assert.throws(() => validateRule({ ...base, schedule: { at: '09:00', days: [7] } }))
    assert.doesNotThrow(() => validateRule({ ...base, schedule: daily }))
    assert.equal(requiredAccess(base), 'triage')
    assert.equal(requiredAccess({ actions: base.actions }), 'triage')
    assert.equal(requiredAccess({ ...base, schedule: daily }), 'send')
    assert.equal(requiredAccess({ ...base, actions: [{ type: 'trash' }] }), 'send')
    assert.equal(requiredAccess({ ...base, actions: [{ type: 'block' }] }), 'send')
  })
})

describe('scheduled rule clock reset', () => {
  const at = (s: string) => new Date(s).getTime()
  const daily = { at: '09:00', days: [] as number[] }
  const mk = (email: string) => {
    seedMessage({ subject: `${email}-1`, fromEmail: email })
    return saveRule({ name: email, conditions: byFrom(email), actions: [{ type: 'archive' }], schedule: daily })
  }
  // back-dated relative to the real clock (3 days), and the check time is the stamp the code wrote: no dependence on today's date
  const STALE = () => Date.now() - 3 * 86_400_000
  const stale = (id: number) => run('UPDATE rules SET last_run_at = ? WHERE id = ?', STALE(), id)
  const due = (id: number) => runDueScheduledRules(lastRun(id) + 1).filter((x) => x.ruleId === id)
  const lastRun = (id: number) => get<{ last_run_at: number }>('SELECT last_run_at FROM rules WHERE id = ?', id)!.last_run_at

  it('re-enabling a rule does not fire an immediate run', () => {
    const r = mk('rs-enable@x.test')
    const off = saveRule({ ...r, enabled: false })
    stale(r.id)
    const on = saveRule({ ...off, enabled: true })
    assert.ok(Math.abs(on.lastRunAt! - Date.now()) < 1000)
    assert.deepEqual(due(r.id), [])
  })

  it('editing actions resets the clock; a name-only edit does not', () => {
    const r = mk('rs-edit@x.test')
    stale(r.id)
    const backdated = lastRun(r.id)
    saveRule({ ...r, lastRunAt: backdated, name: 'renamed', sort: 3 })
    assert.equal(lastRun(r.id), backdated)
    const e = saveRule({ ...r, actions: [{ type: 'mark_read' }] })
    assert.ok(Math.abs(e.lastRunAt! - Date.now()) < 1000)
    assert.deepEqual(due(r.id), [])
  })

  it('editing conditions or match resets the clock', () => {
    const r = mk('rs-cond@x.test')
    stale(r.id)
    saveRule({ ...r, conditions: byFrom('rs-cond2@x.test') })
    assert.ok(Math.abs(lastRun(r.id) - Date.now()) < 1000)
    stale(r.id)
    saveRule({ ...r, conditions: byFrom('rs-cond2@x.test'), match: 'any' })
    assert.ok(Math.abs(lastRun(r.id) - Date.now()) < 1000)
  })
})

describe('agent access for rules', () => {
  const daily = { at: '09:00', days: [] as number[] }
  const setAll = (level: string) => run('UPDATE accounts SET agent_access = ?', level)
  const svc = createService('mcp')

  it('triage may save a plain archive rule, not scheduled or destructive ones', () => {
    seedMessage({ subject: 'ag-1', fromEmail: 'ag@x.test' })
    setAll('triage')
    assert.doesNotThrow(() => svc.saveRule({ name: 'ag-plain', conditions: byFrom('ag@x.test'), actions: [{ type: 'archive' }] }))
    assert.throws(() => svc.saveRule({ name: 'ag-sched', conditions: byFrom('ag@x.test'), actions: [{ type: 'archive' }], schedule: daily }), AccessError)
    assert.throws(() => svc.saveRule({ name: 'ag-trash', conditions: byFrom('ag@x.test'), actions: [{ type: 'trash' }] }), AccessError)
    assert.throws(() => svc.saveRule({ name: 'ag-block', conditions: byFrom('ag@x.test'), actions: [{ type: 'block' }] }), AccessError)
  })

  it('triage may not apply a stored scheduled rule or a trash rule', () => {
    setAll('send')
    const s = svc.saveRule({ name: 'ag-apply-s', conditions: byFrom('ag-s@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    const tr = svc.saveRule({ name: 'ag-apply-t', conditions: byFrom('ag-t@x.test'), actions: [{ type: 'trash' }] })
    const plain = svc.saveRule({ name: 'ag-apply-p', conditions: byFrom('ag-p@x.test'), actions: [{ type: 'archive' }] })
    setAll('triage')
    assert.throws(() => svc.applyRule(s.id), AccessError)
    assert.throws(() => svc.applyRule(tr.id), AccessError)
    assert.doesNotThrow(() => svc.applyRule(plain.id))
  })

  it('send access may do all of it', () => {
    setAll('send')
    const s = svc.saveRule({ name: 'ag-send-s', conditions: byFrom('ag-ss@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    assert.doesNotThrow(() => svc.saveRule({ name: 'ag-send-t', conditions: byFrom('ag-st@x.test'), actions: [{ type: 'trash' }] }))
    assert.doesNotThrow(() => svc.applyRule(s.id))
  })
})

describe('scheduler robustness', () => {
  const at = (s: string) => new Date(s).getTime()
  const daily = { at: '09:00', days: [] as number[] }
  const NOW = at('2026-10-30T10:00')

  it('a malformed stored schedule is skipped and does not stop other rules', () => {
    const bad = saveRule({ name: 'rb-bad', conditions: byFrom('rb-bad@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    run("UPDATE rules SET schedule = '{}', last_run_at = ? WHERE id = ?", at('2026-10-27T09:00'), bad.id)
    const a = seedMessage({ subject: 'rb-ok', fromEmail: 'rb-ok@x.test' })
    const good = saveRule({ name: 'rb-good', conditions: byFrom('rb-ok@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    run('UPDATE rules SET last_run_at = ? WHERE id = ?', at('2026-10-27T09:00'), good.id)
    let out: { ruleId: number; applied: number }[] = []
    assert.doesNotThrow(() => { out = runDueScheduledRules(NOW) })
    assert.ok(out.some((x) => x.ruleId === good.id && x.applied === 1))
    assert.ok(!out.some((x) => x.ruleId === bad.id))
    assert.notEqual(thread(a.threadId).done_at, null)
    assert.equal(lastOccurrence({} as never, NOW), 0)
  })

  it('a rule with corrupt schedule JSON never fires on new mail', () => {
    const a = seedMessage({ subject: 'rb-corrupt', fromEmail: 'rb-corrupt@x.test' })
    const r = saveRule({ name: 'rb-corrupt', conditions: byFrom('rb-corrupt@x.test'), actions: [{ type: 'trash' }], schedule: daily })
    run("UPDATE rules SET schedule = 'not json' WHERE id = ?", r.id)
    processNewMessages(a.accountId, [a.messageId], false)
    assert.equal(hits(r.id), 0)
    assert.equal(runDueScheduledRules(NOW).filter((x) => x.ruleId === r.id).length, 0)
    assert.throws(() => saveRule({ ...listRules().find((x) => x.id === r.id)!, name: 'again' }))
  })

  it('a malformed schedule object reads back as a well-formed placeholder the editor can open', () => {
    for (const bad of ['{}', '{"at":"09:00"}', '[]', '{"at":5,"days":"x"}']) {
      const r = saveRule({ name: 'rb-shape', conditions: byFrom('rb-shape@x.test'), actions: [{ type: 'archive' }], schedule: daily })
      run('UPDATE rules SET schedule = ? WHERE id = ?', bad, r.id)
      const s = listRules().find((x) => x.id === r.id)!.schedule!
      assert.equal(typeof s.at, 'string', bad)
      assert.ok(Array.isArray(s.days), bad)
      assert.equal(lastOccurrence(s, NOW), 0, bad)
    }
  })

  it('a scheduled run can see mail beyond the first N newest and records truncation', () => {
    const old = seedMessage({ subject: 'rb-old', fromEmail: 'rb-old@x.test', ageDays: 400 })
    const r = saveRule({
      name: 'rb-old', actions: [{ type: 'archive' }], schedule: daily,
      conditions: [c('from', 'equals', 'rb-old@x.test'), c('age_days', 'greater_than', '5')],
    })
    const total = scanInbox(1_000_000).length
    const reset = () => run('UPDATE rules SET last_run_at = ? WHERE id = ?', at('2026-10-27T09:00'), r.id)
    const detail = () => JSON.parse(get<{ details: string }>("SELECT details FROM history WHERE action = 'rule-scheduled' AND target = ? ORDER BY id DESC", String(r.id))!.details)
    reset()
    assert.deepEqual(runDueScheduledRules(NOW, total - 1).filter((x) => x.ruleId === r.id), [{ ruleId: r.id, applied: 0 }])
    assert.equal(detail().truncated, true)
    assert.equal(thread(old.threadId).done_at, null)
    reset()
    assert.deepEqual(runDueScheduledRules(NOW, total).filter((x) => x.ruleId === r.id), [{ ruleId: r.id, applied: 1 }])
    assert.equal(detail().truncated, false)
    assert.notEqual(thread(old.threadId).done_at, null)
  })

  it('a slot can be claimed only once', () => {
    const r = saveRule({ name: 'rb-claim', conditions: byFrom('rb-claim@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    run('UPDATE rules SET last_run_at = ? WHERE id = ?', at('2026-10-27T09:00'), r.id)
    const claim = () => run('UPDATE rules SET last_run_at = ? WHERE id = ? AND COALESCE(last_run_at, 0) < ?', NOW, r.id, NOW).changes
    assert.equal(claim(), 1)
    assert.equal(claim(), 0)
    assert.deepEqual(runDueScheduledRules(NOW).filter((x) => x.ruleId === r.id), [])
  })
})

describe('live rule path', () => {
  it('no_notify suppresses the notification, stop ends the chain, hits increment', () => {
    const a = seedMessage({ subject: 'lv-1', fromEmail: 'lv@x.test' })
    run('UPDATE messages SET seen = 0 WHERE id = ?', a.messageId)
    const first = saveRule({ name: 'lv-first', conditions: byFrom('lv@x.test'), actions: [{ type: 'no_notify' }], stop: true })
    const second = saveRule({ name: 'lv-second', conditions: byFrom('lv@x.test'), actions: [{ type: 'archive' }] })
    const out = processNewMessages(a.accountId, [a.messageId], false)
    assert.deepEqual(out.notify, [])
    assert.equal(hits(first.id), 1)
    assert.equal(hits(second.id), 0)
    assert.equal(thread(a.threadId).done_at, null)
  })
})

describe('agent access hardening', () => {
  const daily = { at: '09:00', days: [] as number[] }
  const setAll = (level: string) => run('UPDATE accounts SET agent_access = ?', level)
  const svc = createService('mcp')

  it('moves into trash, junk or blocked need send; ordinary moves and unknown names stay triage', () => {
    const acc = seedMessage({ subject: 'mv-1', fromEmail: 'mv@x.test' }).accountId
    insert('folders', { account_id: acc, path: 'mvTrashX', name: 'mvTrashX', role: 'trash' })
    insert('folders', { account_id: acc, path: 'mvJunkX', name: 'mvJunkX', role: 'junk' })
    insert('folders', { account_id: acc, path: 'mvBlockedX', name: 'mvBlockedX', role: 'blocked' })
    insert('folders', { account_id: acc, path: 'mvPlainX', name: 'mvPlainX', role: null })
    const lv = (v: string) => requiredAccess({ actions: [{ type: 'move', value: v }], schedule: null })
    assert.equal(lv('mvTrashX'), 'send')
    assert.equal(lv('mvJunkX'), 'send')
    assert.equal(lv('mvBlockedX'), 'send')
    assert.equal(lv('mvPlainX'), 'triage')
    assert.equal(lv('mvNoSuchFolder'), 'triage')
    setAll('triage')
    assert.throws(() => svc.saveRule({ name: 'mv-t', conditions: byFrom('mv@x.test'), actions: [{ type: 'move', value: 'mvTrashX' }] }), AccessError)
    assert.doesNotThrow(() => svc.saveRule({ name: 'mv-p', conditions: byFrom('mv@x.test'), actions: [{ type: 'move', value: 'mvPlainX' }] }))
    setAll('send')
    assert.doesNotThrow(() => svc.saveRule({ name: 'mv-t2', conditions: byFrom('mv@x.test'), actions: [{ type: 'move', value: 'mvTrashX' }] }))
  })

  it('triage cannot delete or overwrite a send-level stored rule', () => {
    setAll('send')
    const s = svc.saveRule({ name: 'hd-s', conditions: byFrom('hd@x.test'), actions: [{ type: 'archive' }], schedule: daily })
    const t = svc.saveRule({ name: 'hd-t', conditions: byFrom('hd@x.test'), actions: [{ type: 'trash' }] })
    setAll('triage')
    assert.throws(() => svc.deleteRule(s.id), AccessError)
    assert.throws(() => svc.deleteRule(t.id), AccessError)
    assert.throws(() => svc.saveRule({ ...s, actions: [{ type: 'archive' }], schedule: null }), AccessError)
    assert.throws(() => svc.saveRule({ ...t, actions: [{ type: 'archive' }] }), AccessError)
    setAll('send')
    assert.doesNotThrow(() => svc.saveRule({ ...s, schedule: null }))
    assert.doesNotThrow(() => svc.deleteRule(t.id))
  })
})
