import { Eye, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isGroup, SCHEDULE_SAFE_ACTIONS } from '../../../shared/rules'
import { actionsForSchedule, canAddGroup, countLeaves, insertAt, removeAt, ruleProblem, updateAt, type NodePath, type RuleProblem } from '../../../shared/rules-edit'
import type { Rule, RuleAction, RuleCondition, RuleGroup, RuleNode, RulePreview, RuleSchedule } from '../../../shared/types'
import { t, tp } from '../../../shared/i18n'
import { api, errorText } from '../lib/api'
import { useStore } from '../lib/store'
import { Button, cx, Field, IconButton, inputCls, Modal, Select, Spinner, Toggle } from '../components/ui'

const FIELDS: { value: RuleCondition['field']; label: string }[] = [
  { value: 'from', label: t('Sender') }, { value: 'to', label: t('To') }, { value: 'any_recipient', label: t('To or Cc') }, { value: 'subject', label: t('Subject') },
  { value: 'body', label: t('Body') }, { value: 'account', label: t('Account') }, { value: 'category', label: t('Category') }, { value: 'has_attachment', label: t('Attachment (yes/no)') }, { value: 'list_id', label: t('Mailing list') },
  { value: 'age_days', label: t('Message age (days)') },
]
const TEXT_OPS: { value: RuleCondition['op']; label: string }[] = [
  { value: 'contains', label: t('contains') }, { value: 'not_contains', label: t('does not contain') }, { value: 'equals', label: t('is exactly') },
  { value: 'starts_with', label: t('starts with') }, { value: 'ends_with', label: t('ends with') }, { value: 'matches', label: t('matches the regular expression') },
]
const AGE_OPS: { value: RuleCondition['op']; label: string }[] = [
  { value: 'greater_than', label: t('is older than') }, { value: 'less_than', label: t('is newer than') },
]
const OPS = [...TEXT_OPS, ...AGE_OPS]
const ACTIONS: { value: RuleAction['type']; label: string; needs?: string }[] = [
  { value: 'archive', label: t('Done (archive)') }, { value: 'mark_read', label: t('Mark as read') }, { value: 'pin', label: t('Pin') },
  { value: 'move', label: t('Move to folder'), needs: t('folder path') }, { value: 'label', label: t('Add label (Gmail)'), needs: t('label') },
  { value: 'categorize', label: t('Set category'), needs: 'people / notification / newsletter' }, { value: 'snooze', label: t('Snooze for N hours'), needs: t('number of hours') },
  { value: 'mute', label: t('Mute conversation') }, { value: 'set_aside', label: t('Set aside') }, { value: 'no_notify', label: t('No notification') },
  { value: 'priority', label: t('Mark as priority') },
  { value: 'trash', label: t('Move to Trash') }, { value: 'block', label: t('Block sender') },
]
const GROUPS: { value: RuleGroup['group']; label: string }[] = [
  { value: 'all', label: t('all of these are met') }, { value: 'any', label: t('any of these is met') }, { value: 'none', label: t('none of these is met') },
]
const MAX_LEAVES = 20

type Draft = Partial<Rule> & { name: string; conditions: RuleNode[]; actions: RuleAction[] }

const problemText = (p: RuleProblem): string => ({
  name: t('Give the rule a name'),
  no_conditions: t('Add at least one condition'),
  no_actions: t('Add at least one action'),
  empty_group: t('A condition group cannot be empty'),
  age_value: t('Message age must be a whole number of days'),
  time: t('Schedule time must look like 09:00'),
})[p]

const newCondition = (): RuleCondition => ({ field: 'subject', op: 'contains', value: '' })
const dayNames = () => t('Sun Mon Tue Wed Thu Fri Sat').split(' ')
const actionLabel = (a: RuleAction) => (ACTIONS.find((x) => x.value === a.type)?.label ?? '') + (a.value ? ` (${a.value})` : '')

function describe(n: RuleNode): string {
  if (isGroup(n)) return `(${GROUPS.find((g) => g.value === n.group)?.label}: ${n.items.map(describe).join(', ')})`
  return t('{field} {op} “{value}”', { field: FIELDS.find((f) => f.value === n.field)?.label ?? '', op: OPS.find((o) => o.value === n.op)?.label ?? '', value: n.value })
}

function scheduleText(s: RuleSchedule): string {
  const names = dayNames()
  return s.days.length && s.days.length < 7 ? t('{time} on {days}', { time: s.at, days: [...s.days].sort().map((d) => names[d]).join(' ') }) : t('daily at {time}', { time: s.at })
}

/** One condition row, or a group card holding more of them. */
function ConditionNodeEditor({ node, path, root, setRoot }: { node: RuleNode; path: NodePath; root: RuleNode[]; setRoot: (n: RuleNode[]) => void }) {
  const remove = (
    <IconButton onClick={() => setRoot(removeAt(root, path))} disabled={root.length === 1 && path.length === 1} aria-label={t('Remove')}><X size={14} /></IconButton>
  )
  if (isGroup(node)) {
    return (
      <div className="mt-2 rounded-lg border border-line bg-surface-2/40 p-2.5">
        <div className="flex items-center gap-2 text-[13px]">
          <Select className="min-w-0 flex-1" value={node.group} onChange={(v) => setRoot(updateAt(root, path, (g) => ({ ...(g as RuleGroup), group: v })))} options={GROUPS} />
          {remove}
        </div>
        <NodeList nodes={node.items} path={path} root={root} setRoot={setRoot} />
      </div>
    )
  }
  const age = node.field === 'age_days'
  const patch = (p: Partial<RuleCondition>) => setRoot(updateAt(root, path, (x) => (isGroup(x) ? x : { ...x, ...p })))
  return (
    <div className="mt-2 flex gap-2 max-md:flex-wrap">
      <Select className="w-44" value={node.field} onChange={(v) => patch(v === 'age_days' ? { field: v, op: 'greater_than', value: '' } : age ? { field: v, op: 'contains' } : { field: v })} options={FIELDS} />
      <Select className="w-48" value={node.op} onChange={(v) => patch({ op: v })} options={age ? AGE_OPS : TEXT_OPS} />
      <input className={cx(inputCls, 'max-md:min-w-0')} type={age ? 'number' : 'text'} min={age ? 0 : undefined} step={age ? 1 : undefined} placeholder={age ? t('days') : undefined} value={node.value} onChange={(e) => patch({ value: e.target.value })} />
      {remove}
    </div>
  )
}

/** The children of the root or of a group, plus the buttons that add to it. */
function NodeList({ nodes, path, root, setRoot }: { nodes: RuleNode[]; path: NodePath; root: RuleNode[]; setRoot: (n: RuleNode[]) => void }) {
  const full = countLeaves(root) >= MAX_LEAVES
  return (
    <>
      {nodes.map((n, i) => <ConditionNodeEditor key={i} node={n} path={[...path, i]} root={root} setRoot={setRoot} />)}
      <div className="mt-2 flex gap-1">
        <Button size="sm" variant="ghost" disabled={full} onClick={() => setRoot(insertAt(root, path, newCondition()))}><Plus size={13} /> {t('Condition')}</Button>
        {canAddGroup(path) && (
          <Button size="sm" variant="ghost" disabled={full} onClick={() => setRoot(insertAt(root, path, { group: 'any', items: [newCondition()] }))}><Plus size={13} /> {t('Group')}</Button>
        )}
      </div>
    </>
  )
}

export default function RulesTab() {
  const [list, setList] = useState<Rule[]>([])
  const [edit, setEdit] = useState<Draft | null>(null)
  const [preview, setPreview] = useState<RulePreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const toast = useStore((s) => s.toast)
  const load = async () => setList(await api.listRules())
  useEffect(() => void load(), [])

  const open = (r: Draft) => (setEdit(r), setPreview(null), setNotice(null))
  const schedule = edit?.schedule ?? null
  const problem = edit ? ruleProblem(edit) : null
  const actionOptions = schedule ? ACTIONS.filter((a) => SCHEDULE_SAFE_ACTIONS.includes(a.value)) : ACTIONS

  const setSchedule = (on: boolean) => {
    if (!edit) return
    if (!on) return (setEdit({ ...edit, schedule: null }), setNotice(null))
    const { actions, removed, addedDefault } = actionsForSchedule(edit.actions)
    const names = removed.map((x) => ACTIONS.find((a) => a.value === x)?.label).join(', ')
    setNotice(!removed.length ? null : addedDefault
      ? t('Scheduled rules only use actions that are safe to repeat. Removed: {actions}. Added “{action}” so the rule still has an action.', { actions: names, action: ACTIONS.find((a) => a.value === 'archive')!.label })
      : t('Scheduled rules only use actions that are safe to repeat. Removed: {actions}', { actions: names }))
    setEdit({ ...edit, actions, schedule: { at: '09:00', days: [] } })
  }
  const setDay = (d: number, on: boolean) => {
    if (!schedule) return
    const days = on ? [...schedule.days, d] : schedule.days.filter((x) => x !== d)
    setEdit({ ...edit!, schedule: { ...schedule, days: days.length === 7 ? [] : days.sort() } })
  }

  const runPreview = async () => {
    setChecking(true)
    try {
      setPreview(await api.previewRule({ match: edit!.match || 'all', conditions: edit!.conditions, actions: edit!.actions }))
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    } finally {
      setChecking(false)
    }
  }

  const applyNow = async (r: Rule) => {
    try {
      const p = await api.previewRule(r)
      if (!p.matchedThreads) return toast({ level: 'info', message: t('No conversation matches this rule') })
      const more = p.truncated ? ' ' + t('Only the newest {scanned} messages were checked', { scanned: p.scanned }) + '.' : ''
      if (!window.confirm(tp(p.matchedThreads, 'Apply “{name}” to {n} conversation?', 'Apply “{name}” to {n} conversations?', { name: r.name }) + more)) return
      const res = await api.applyRule(r.id)
      const msg = tp(res.applied, 'Applied to {n} existing conversation', 'Applied to {n} existing conversations')
      toast({ level: 'success', message: res.truncated ? `${msg}. ${t('Only the newest messages were checked, so older ones may remain.')}` : msg })
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    }
  }

  const days = dayNames()
  return (
    <section>
      <div className="mb-1 text-[12.5px] text-muted">{t('They run on new messages arriving in the Inbox (e.g. “from invoices@… → label Accounting and done”).')}</div>
      <div className="flex flex-col">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0 max-md:flex-wrap">
            <Toggle checked={r.enabled} onChange={async (v) => (await api.saveRule({ ...r, enabled: v }), void load())} />
            <div className="min-w-0 flex-1 max-md:min-w-40">
              <div className="font-medium">{r.name}</div>
              <div className="truncate text-[12px] text-muted">
                {r.conditions.map(describe).join(r.match === 'all' ? ` ${t('and')} ` : ` ${t('or')} `)} → {r.actions.map(actionLabel).join(', ')} · {t('used {n}×', { n: r.hits })}
                {r.schedule && ` · ${scheduleText(r.schedule)}`}
              </div>
            </div>
            <Button size="sm" onClick={() => void applyNow(r)}>{t('Apply now')}</Button>
            <Button size="sm" onClick={() => open(r)}>{t('Edit')}</Button>
            <IconButton onClick={async () => window.confirm(t('Delete this rule?')) && (await api.deleteRule(r.id), void load())}><Trash2 size={14} /></IconButton>
          </div>
        ))}
        <div className="py-2"><Button size="sm" variant="ghost" onClick={() => open({ name: t('New rule'), match: 'all', conditions: [newCondition()], actions: [{ type: 'archive' }], schedule: null })}><Plus size={14} /> {t('New rule')}</Button></div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('Rule')} width={760} footer={
        <>
          {checking && <Spinner className="mr-auto self-center" />}
          {problem && <span className="mr-auto self-center text-[12.5px] text-danger">{problemText(problem)}</span>}
          <Button variant="ghost" disabled={checking || !!problem} onClick={() => void runPreview()}><Eye size={14} /> {t('Preview')}</Button>
          <Button variant="primary" disabled={!!problem} onClick={async () => {
            try {
              await api.saveRule(edit!)
              setEdit(null)
              void load()
            } catch (e) {
              toast({ level: 'error', message: errorText(e) })
            }
          }}>{t('Save')}</Button>
        </>
      }>
        {edit && (
          <div className="p-5">
            <Field label={t('Name')}><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              {t('When')}
              <Select className="w-48" value={edit.match || 'all'} onChange={(v) => setEdit({ ...edit, match: v })} options={[{ value: 'all', label: t('all of the conditions') }, { value: 'any', label: t('any of the conditions') }]} />
              {t('are met:')}
            </div>
            <NodeList nodes={edit.conditions} path={[]} root={edit.conditions} setRoot={(conditions) => (setEdit({ ...edit, conditions }), setPreview(null))} />
            <div className="mt-4 text-[13px]">{t('Then:')}</div>
            {edit.actions.map((a, i) => (
              <div key={i} className="mt-2 flex gap-2 max-md:flex-wrap">
                <Select className="w-64 max-md:min-w-0 max-md:flex-1" value={a.type} onChange={(v) => setEdit({ ...edit, actions: edit.actions.map((x, j) => (j === i ? { type: v } : x)) })} options={actionOptions} />
                {ACTIONS.find((x) => x.value === a.type)?.needs && (
                  <input className={inputCls} placeholder={ACTIONS.find((x) => x.value === a.type)?.needs} value={a.value || ''} onChange={(e) => setEdit({ ...edit, actions: edit.actions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                )}
                <IconButton disabled={edit.actions.length === 1} onClick={() => setEdit({ ...edit, actions: edit.actions.filter((_, j) => j !== i) })} aria-label={t('Remove')}><X size={14} /></IconButton>
              </div>
            ))}
            <Button className="mt-2" size="sm" variant="ghost" onClick={() => setEdit({ ...edit, actions: [...edit.actions, { type: 'mark_read' }] })}><Plus size={13} /> {t('Action')}</Button>
            <div className="mt-3"><Toggle checked={!!edit.stop} onChange={(v) => setEdit({ ...edit, stop: v })} label={t('Stop processing more rules')} /></div>
            <div className="mt-4 border-t border-line pt-3">
              <Toggle checked={!!schedule} onChange={setSchedule} label={t('Run on a schedule')} hint={t('Also runs at a set time on existing Inbox messages.')} />
              {notice && <div className="mt-2 rounded-md bg-accent-soft px-3 py-2 text-[12.5px] text-accent">{notice}</div>}
              {schedule && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                  {t('At')}
                  <input className={cx(inputCls, 'w-28! flex-none')} type="time" value={schedule.at} onChange={(e) => e.target.value && setEdit({ ...edit, schedule: { ...schedule, at: e.target.value } })} />
                  <div className="flex gap-1">
                    {days.map((n, d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={schedule.days.includes(d)}
                        className={cx('h-8 min-w-9 rounded-md border px-1.5 text-[12px]', schedule.days.includes(d) ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-fg')}
                        onClick={() => setDay(d, !schedule.days.includes(d))}
                      >{n}</button>
                    ))}
                  </div>
                  <span className="text-[12px] text-muted">{t('No day selected means every day.')}</span>
                </div>
              )}
            </div>
            {preview && (
              <div className="mt-4 rounded-lg border border-line p-3 text-[13px]">
                <div className="font-medium">{tp(preview.matchedThreads, '{n} conversation matches', '{n} conversations match')}</div>
                {preview.sample.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-[12.5px] text-muted">
                    {preview.sample.map((s) => <li key={s.messageId} className="truncate">{s.subject || t('(no subject)')}</li>)}
                  </ul>
                )}
                {preview.truncated && <div className="mt-1 text-[12px] text-muted">{t('Only the newest {scanned} messages were checked', { scanned: preview.scanned })}</div>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}
