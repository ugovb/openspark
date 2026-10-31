// Mail rules (Spark "Workflows" without the cloud): conditions on new incoming mail → actions.
import { t } from '../shared/i18n'
import { isGroup, isValidSchedule, lastOccurrence, SCHEDULE_SAFE_ACTIONS } from '../shared/rules'
import type { Category, Rule, RuleAction, RuleApplyResult, RuleCondition, RuleNode, RulePreview, RuleSchedule } from '../shared/types'
import * as A from './actions'
import { all, get, insert, inList, now, parseJson, type Row, run, update } from './db'
import { bus, log } from './events'
import { record } from './history'
import { contactOverride } from './smart'

/** Stands in for a stored schedule that cannot be read: truthy so the rule never runs live, invalid so it never runs on schedule. */
const BROKEN_SCHEDULE: RuleSchedule = { at: '', days: [] }
const warned = new Set<number>()

function readSchedule(r: Row): RuleSchedule | null {
  if (!r.schedule) return null
  const s = parseJson<RuleSchedule | null>(r.schedule, null)
  if (s && isValidSchedule(s)) return s
  if (!warned.has(r.id)) {
    warned.add(r.id)
    log('rules', `rule ${r.id} has an unreadable schedule and is inactive until it is saved again`)
  }
  // always a well-formed shape, so the editor can open the rule and the user can fix or delete it
  return BROKEN_SCHEDULE
}

export function rowToRule(r: Row): Rule {
  return {
    id: r.id,
    name: r.name,
    enabled: !!r.enabled,
    match: r.match,
    conditions: parseJson<RuleNode[]>(r.conditions, []),
    actions: parseJson<RuleAction[]>(r.actions, []),
    stop: !!r.stop,
    sort: r.sort,
    hits: r.hits,
    schedule: readSchedule(r),
    lastRunAt: r.last_run_at ?? null,
  }
}

export function listRules(): Rule[] {
  return all('SELECT * FROM rules ORDER BY sort, id').map(rowToRule)
}

export function validateRule(r: Pick<Rule, 'conditions' | 'actions' | 'schedule'>): void {
  validateConditions(r.conditions)
  const s = r.schedule
  if (!s) return
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.at || '')) throw new Error(t('Schedule time must look like 09:00'))
  if (!Array.isArray(s.days) || s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error(t('Schedule days must be 0 (Sunday) to 6 (Saturday)'))
  if (r.actions.some((a) => !SCHEDULE_SAFE_ACTIONS.includes(a.type))) throw new Error(t('This action cannot be used in a scheduled rule'))
}

/** Agents need "send" for rules that run unattended or destroy/block. */
export function requiredAccess(r: Pick<Rule, 'actions'> & { schedule?: RuleSchedule | null }): 'triage' | 'send' {
  if (r.schedule) return 'send'
  return r.actions.some((a) => a.type === 'trash' || a.type === 'block' || (a.type === 'move' && movesToRiskyFolder(a.value))) ? 'send' : 'triage'
}

function movesToRiskyFolder(target: string | undefined): boolean {
  if (!target) return false
  return !!get("SELECT 1 FROM folders WHERE (path = ? OR name = ?) AND role IN ('trash', 'junk', 'blocked') LIMIT 1", target, target)
}

export function saveRule(r: Partial<Rule> & { name: string; conditions: RuleNode[]; actions: RuleAction[] }): Rule {
  const schedule = r.schedule ?? null
  validateRule({ conditions: r.conditions, actions: r.actions, schedule })
  const scheduleJson = schedule ? JSON.stringify({ at: schedule.at, days: [...schedule.days].sort((a, b) => a - b) }) : null
  const stored = r.id ? get<Row>('SELECT * FROM rules WHERE id = ?', r.id) : undefined
  const enabled = r.enabled ?? true
  const match = r.match || 'all'
  const conditionsJson = JSON.stringify(r.conditions)
  const actionsJson = JSON.stringify(r.actions)
  // a scheduled rule's clock restarts when it is new, re-enabled or its behavior changes, so it never fires from a stale run time
  const unchanged =
    !!stored && stored.schedule === scheduleJson && !!stored.enabled === enabled && stored.match === match &&
    stored.conditions === conditionsJson && stored.actions === actionsJson
  const lastRun = !scheduleJson ? null : unchanged ? stored!.last_run_at : now()
  const fields = {
    schedule: scheduleJson,
    last_run_at: lastRun,
    name: r.name,
    enabled,
    match,
    conditions: conditionsJson,
    actions: actionsJson,
    stop: r.stop ?? false,
    sort: r.sort ?? 0,
  }
  const id = r.id ? (update('rules', r.id, fields), r.id) : insert('rules', { ...fields, created_at: now() })
  return rowToRule(get('SELECT * FROM rules WHERE id = ?', id)!)
}

export function deleteRule(id: number): void {
  run('DELETE FROM rules WHERE id = ?', id)
}

function fieldValue(m: Row, field: RuleCondition['field']): string {
  switch (field) {
    case 'from':
      return `${m.from_name || ''} <${m.from_email || ''}>`
    case 'to':
      return m.to_json || ''
    case 'cc':
      return m.cc_json || ''
    case 'any_recipient':
      return `${m.to_json || ''} ${m.cc_json || ''}`
    case 'subject':
      return m.subject || ''
    case 'body':
      return (get<{ text: string }>('SELECT text FROM bodies WHERE message_id = ?', m.id)?.text || m.snippet || '')
    case 'account':
      return get<{ email: string }>('SELECT email FROM accounts WHERE id = ?', m.account_id)?.email || ''
    case 'category':
      return m.category || ''
    case 'has_attachment':
      return m.has_attachments ? 'yes' : 'no'
    case 'list_id':
      return m.list_id || ''
    case 'age_days':
      return ''
  }
}

const DAY_MS = 86_400_000
const validAgeValue = (v: string): boolean => /^\d+$/.test((v || '').trim())

export function conditionMatches(m: Row, c: RuleCondition): boolean {
  if (c.field === 'age_days') {
    if (!m.date || !validAgeValue(c.value)) return false
    const age = (Date.now() - m.date) / DAY_MS
    const limit = Number(c.value.trim())
    return c.op === 'greater_than' ? age > limit : c.op === 'less_than' ? age < limit : false
  }
  const hay = fieldValue(m, c.field).toLowerCase()
  const v = (c.value || '').toLowerCase()
  switch (c.op) {
    case 'contains':
      return hay.includes(v)
    case 'not_contains':
      return !hay.includes(v)
    case 'equals':
    case 'is':
      return hay === v || hay.includes(`<${v}>`)
    case 'starts_with':
      return hay.startsWith(v)
    case 'ends_with':
      return hay.endsWith(v) || hay.endsWith(`${v}>`)
    case 'matches':
      try {
        return new RegExp(c.value, 'i').test(hay)
      } catch {
        return false
      }
    case 'greater_than':
    case 'less_than':
      return false
  }
}

export function nodeMatches(m: Row, n: RuleNode): boolean {
  if (!isGroup(n)) return conditionMatches(m, n)
  if (n.group === 'all') return n.items.every((x) => nodeMatches(m, x))
  if (n.group === 'any') return n.items.some((x) => nodeMatches(m, x))
  return !n.items.some((x) => nodeMatches(m, x))
}

export function ruleMatches(rule: Rule, m: Row): boolean {
  if (!rule.conditions.length) return false
  return rule.match === 'any' ? rule.conditions.some((c) => nodeMatches(m, c)) : rule.conditions.every((c) => nodeMatches(m, c))
}

const MAX_DEPTH = 3
const MAX_LEAVES = 20

/** Throws when a condition tree is too deep, too big or has an empty group. */
export function validateConditions(nodes: RuleNode[]): void {
  let leaves = 0
  const walk = (list: RuleNode[], depth: number): void => {
    for (const n of list) {
      if (!isGroup(n)) {
        const isAge = n.field === 'age_days'
        const isCmp = n.op === 'greater_than' || n.op === 'less_than'
        if (isAge !== isCmp) throw new Error(t('Message age conditions use only “greater than” or “less than”'))
        if (isAge && !validAgeValue(n.value)) throw new Error(t('Message age must be a whole number of days'))
        leaves++
        continue
      }
      if (n.group !== 'all' && n.group !== 'any' && n.group !== 'none') throw new Error(t('A condition group must be all, any or none'))
      if (!Array.isArray(n.items)) throw new Error(t('A condition group needs a list of items'))
      if (depth >= MAX_DEPTH) throw new Error(t('Condition groups can be nested at most {n} levels deep', { n: MAX_DEPTH }))
      if (!n.items.length) throw new Error(t('A condition group cannot be empty'))
      walk(n.items, depth + 1)
    }
  }
  walk(nodes, 0)
  if (leaves > MAX_LEAVES) throw new Error(t('A rule can have at most {n} conditions', { n: MAX_LEAVES }))
}

/** Runs every action on a message's conversation. A failing action is logged and the rest still run. */
export function applyActions(actions: RuleAction[], m: Row): { suppressNotify: boolean } {
  let suppressNotify = false
  for (const a of actions) {
    try {
      if (a.type === 'no_notify') suppressNotify = true
      applyAction(a, m)
    } catch (e) {
      log('rules', 'action failed', (e as Error).message)
    }
  }
  return { suppressNotify }
}

function applyAction(a: RuleAction, m: Row): void {
  const t = [m.thread_id]
  switch (a.type) {
    case 'archive':
      A.archive(t, 'rule')
      break
    case 'trash':
      A.trash(t, 'rule')
      break
    case 'mark_read':
      A.markRead(t, true, 'rule')
      break
    case 'pin':
      A.pin(t, true, 'rule')
      break
    case 'mute':
      A.mute(t, true, 'rule')
      break
    case 'set_aside':
      A.setAside(t, true, 'rule')
      break
    case 'priority':
      A.priority(t, true, 'rule')
      break
    case 'categorize':
      run('UPDATE messages SET category = ? WHERE id = ?', a.value, m.id)
      run('UPDATE threads SET category = ? WHERE id = ?', a.value, m.thread_id)
      break
    case 'move': {
      const f = get<{ id: number }>('SELECT id FROM folders WHERE account_id = ? AND (path = ? OR name = ?)', m.account_id, a.value, a.value)
      if (f) A.moveToFolder(t, f.id, 'rule')
      break
    }
    case 'label':
      if (a.value) A.setLabel(t, a.value, true, 'rule')
      break
    case 'snooze': {
      const hours = Number(a.value) || 24
      A.snooze(t, now() + hours * 3600_000, 'rule')
      break
    }
    case 'block':
      if (m.from_email) A.blockSenders([m.from_email], 'rule')
      break
    default:
      // no_notify is handled by applyActions; actions saved by older versions (notify, forward) are skipped
      if (a.type !== 'no_notify') log('rules', `skipped stored action type "${String(a.type)}"`)
      break
  }
}

/** Newest inbox messages, incoming and visible only. */
export function scanInbox(limit: number): Row[] {
  return all(
    `SELECT m.* FROM messages m JOIN folders f ON f.id = m.folder_id
     WHERE f.role = 'inbox' AND m.hidden = 0 AND m.is_outgoing = 0 ORDER BY m.date DESC LIMIT ?`,
    limit,
  )
}

/** Runs after sync stores new messages; also enforces blocks, mutes and snooze wake-ups. */
export function processNewMessages(accountId: number, ids: number[], initial: boolean): { notify: number[] } {
  if (!ids.length) return { notify: [] }
  const rows = all(
    `SELECT m.*, f.role, t.muted, t.snoozed_until FROM messages m JOIN folders f ON f.id = m.folder_id JOIN threads t ON t.id = m.thread_id
     WHERE m.id IN (${inList(ids)}) AND m.is_outgoing = 0`,
    ...ids,
  )
  const rules = listRules().filter((r) => r.enabled && !r.schedule)
  const notify: number[] = []
  const suppressed = new Set<number>()
  for (const m of rows) {
    if (m.role !== 'inbox') continue
    if (m.from_email && contactOverride(m.from_email).status === 'blocked') {
      if (!initial) A.blockSenders([m.from_email], 'rule')
      suppressed.add(m.id)
      continue
    }
    if (m.muted) {
      if (!m.seen) A.markMessagesRead([m.id], true, 'rule')
      suppressed.add(m.id)
    }
    // a reply to a snoozed conversation brings it back
    if (!initial && m.snoozed_until && m.snoozed_until > now()) {
      run('UPDATE threads SET snoozed_until = NULL, resurfaced_at = ? WHERE id = ?', now(), m.thread_id)
    }
    if (!initial) {
      for (const rule of rules) {
        if (!ruleMatches(rule, m)) continue
        log('rules', `rule "${rule.name}" matched message ${m.id}`)
        run('UPDATE rules SET hits = hits + 1 WHERE id = ?', rule.id)
        if (applyActions(rule.actions, m).suppressNotify) suppressed.add(m.id)
        record('rule', 'rule-applied', m.id, { rule: rule.name })
        if (rule.stop) break
      }
    }
    if (!initial && !m.seen && !suppressed.has(m.id)) notify.push(m.id)
  }
  if (notify.length) bus.emitEvent({ type: 'new-mail', accountId, messageIds: notify })
  return { notify }
}

const asRule = (rule: Pick<Rule, 'match' | 'conditions' | 'actions'>): Rule =>
  ({ ...rule, id: 0, name: '', enabled: true, stop: false, sort: 0, hits: 0, schedule: null, lastRunAt: null })

/** Dry run: what would this rule touch among the newest inbox mail? Counts conversations, not messages. */
export function previewRule(rule: Pick<Rule, 'match' | 'conditions' | 'actions'>, limit = 500): RulePreview {
  const rows = scanInbox(limit + 1)
  const truncated = rows.length > limit
  const scanned = rows.slice(0, limit)
  const full = asRule(rule)
  const threads = new Set<number>()
  const sample: RulePreview['sample'] = []
  for (const m of scanned) {
    if (threads.has(m.thread_id) || !ruleMatches(full, m)) continue
    threads.add(m.thread_id)
    if (sample.length < 10) {
      sample.push({ threadId: m.thread_id, messageId: m.id, subject: m.subject || '', from: m.from_name || m.from_email || '', date: m.date })
    }
  }
  return { scanned: scanned.length, truncated, matchedThreads: threads.size, sample }
}

/** Run a rule over existing inbox mail ("apply to existing"). */
export function applyRuleToExisting(ruleId: number, limit = 500): RuleApplyResult {
  const rule = listRules().find((r) => r.id === ruleId)
  if (!rule) throw new Error(t('Rule does not exist'))
  const rows = scanInbox(limit + 1)
  const truncated = rows.length > limit
  const doneThreads = new Set<number>()
  let applied = 0
  for (const m of rows.slice(0, limit)) {
    if (doneThreads.has(m.thread_id) || !ruleMatches(rule, m)) continue
    doneThreads.add(m.thread_id)
    applyActions(rule.actions, m)
    record('rule', 'rule-applied', m.id, { rule: rule.name, existing: true })
    applied++
  }
  if (applied) run('UPDATE rules SET hits = hits + ? WHERE id = ?', applied, rule.id)
  return { matched: doneThreads.size, applied, truncated }
}

const SCHEDULED_SCAN_LIMIT = 5000

/** Runs scheduled rules whose latest slot has passed since their last run. One catch-up run, never a backlog. A failing rule is logged and skipped. */
export function runDueScheduledRules(nowMs: number = Date.now(), scanLimit: number = SCHEDULED_SCAN_LIMIT): { ruleId: number; applied: number }[] {
  const out: { ruleId: number; applied: number }[] = []
  let list: Rule[]
  try {
    list = listRules()
  } catch (e) {
    log('rules', 'could not read rules', (e as Error).message)
    return out
  }
  for (const rule of list) {
    try {
      if (!rule.enabled || !rule.schedule) continue
      const slot = lastOccurrence(rule.schedule, nowMs)
      if (!slot || slot <= (rule.lastRunAt ?? 0)) continue
      // atomic claim: another process on the same profile cannot run the same slot
      if (run('UPDATE rules SET last_run_at = ? WHERE id = ? AND COALESCE(last_run_at, 0) < ?', nowMs, rule.id, nowMs).changes === 0) continue
      const rows = scanInbox(scanLimit + 1)
      const truncated = rows.length > scanLimit
      const done = new Set<number>()
      let applied = 0
      for (const m of rows.slice(0, scanLimit)) {
        if (done.has(m.thread_id) || !ruleMatches(rule, m)) continue
        done.add(m.thread_id)
        applyActions(rule.actions, m)
        applied++
      }
      if (applied) run('UPDATE rules SET hits = hits + ? WHERE id = ?', applied, rule.id)
      record('rule', 'rule-scheduled', rule.id, { rule: rule.name, applied, truncated })
      out.push({ ruleId: rule.id, applied })
    } catch (e) {
      log('rules', `scheduled rule ${rule.id} failed`, (e as Error).message)
    }
  }
  return out
}

export function testRule(rule: Pick<Rule, 'match' | 'conditions'>, limit = 300): Row[] {
  const rows = all(
    `SELECT m.id, m.thread_id, m.subject, m.from_name, m.from_email, m.date, m.to_json, m.cc_json, m.category, m.has_attachments, m.list_id, m.snippet, m.account_id
     FROM messages m JOIN folders f ON f.id = m.folder_id WHERE f.role = 'inbox' AND m.hidden = 0 ORDER BY m.date DESC LIMIT ?`,
    limit,
  )
  return rows.filter((m) => ruleMatches({ ...rule, id: 0, name: '', enabled: true, actions: [], stop: false, sort: 0, hits: 0, schedule: null, lastRunAt: null }, m))
}

export function suggestedCategory(email: string): Category | null {
  return contactOverride(email).category
}
