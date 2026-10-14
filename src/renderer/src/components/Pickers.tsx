import { CalendarClock, Check, Folder as FolderIcon, Plus, Search, Tag } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { availablePresets, formatWhen, parseWhen, presetLabel, presetTime, SOMEDAY } from '../../../shared/when'
import { api, errorText } from '../lib/api'
import { useStore } from '../lib/store'
import { cx, inputCls, Modal } from './ui'
import { t } from '../../../shared/i18n'

/** Snooze / Remind picker: presets plus natural-language input ("jutro 9", "pt 14:30", "za 3 dni"). */
export function SnoozePicker() {
  const { snoozeFor, pickerMode, settings, snooze, remind, threads } = useStore()
  const [text, setText] = useState('')
  const [noReply, setNoReply] = useState(true)
  const [hi, setHi] = useState(0)
  const open = !!snoozeFor?.length
  const close = () => useStore.setState({ snoozeFor: null })
  useEffect(() => {
    setText('')
    setHi(0)
  }, [open])
  const cfg = { morningHour: settings?.snoozeMorningHour ?? 8, eveningHour: settings?.snoozeEveningHour ?? 18 }
  const presets = availablePresets(pickerMode === 'remind' ? 'remind' : 'snooze', new Date(), cfg)
  const parsed = text.trim() ? parseWhen(text, new Date(), cfg) : null
  const options = useMemo(() => {
    const list = presets.map((p) => ({ label: presetLabel(p), ts: presetTime(p, new Date(), cfg) }))
    if (parsed) list.unshift({ label: text.trim(), ts: parsed })
    return list
  }, [text, pickerMode, open])
  const pick = (ts: number) => {
    const ids = snoozeFor || []
    close()
    if (pickerMode === 'remind') {
      const outgoingLast = ids.every((id) => threads.find((x) => x.thread_id === id)?.outgoing_last)
      void remind(ids, ts, noReply && outgoingLast ? 'no-reply' : 'manual')
    } else void snooze(ids, ts)
  }
  return (
    <Modal open={open} onClose={close} title={pickerMode === 'remind' ? t('Remind me') : t('Snooze until later')} width={430}>
      <div className="p-3">
        <div className="relative mb-2">
          <CalendarClock size={15} className="absolute left-3 top-2.5 text-muted" />
          <input
            autoFocus
            className={cx(inputCls, 'pl-9')}
            placeholder={t('e.g. tomorrow 9:00, fri 14:30, 20.10, in 3 days')}
            value={text}
            onChange={(e) => (setText(e.target.value), setHi(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, options.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
              if (e.key === 'Enter' && options[hi]) pick(options[hi].ts)
            }}
          />
        </div>
        {text.trim() && !parsed && <div className="px-2 pb-2 text-[12px] text-danger">{t('I don’t recognize this date')}</div>}
        {options.map((o, i) => (
          <button key={o.label + i} onMouseEnter={() => setHi(i)} onClick={() => pick(o.ts)} className={cx('flex w-full items-center rounded-lg px-3 py-2 text-left text-[13.5px]', i === hi ? 'bg-accent-soft text-accent' : 'hover:bg-hover')}>
            <span className="flex-1">{o.label}</span>
            <span className="text-[12px] text-muted">{o.ts >= SOMEDAY ? '' : formatWhen(o.ts)}</span>
          </button>
        ))}
        {pickerMode === 'remind' && (
          <label className="mt-2 flex items-center gap-2 px-3 text-[12.5px] text-muted">
            <input type="checkbox" checked={noReply} onChange={(e) => setNoReply(e.target.checked)} /> {t('Only if no one replies (for messages I sent)')}
          </label>
        )}
      </div>
    </Modal>
  )
}

export function MovePicker() {
  const { moveFor, folders, accounts, threads, move } = useStore()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const open = !!moveFor?.length
  const close = () => useStore.setState({ moveFor: null })
  useEffect(() => {
    setQ('')
    setHi(0)
  }, [open])
  const accIds = new Set((moveFor || []).map((id) => threads.find((x) => x.thread_id === id)?.account_id).filter(Boolean))
  const list = folders
    .filter((f) => (accIds.size ? accIds.has(f.account_id) : true) && f.role !== 'drafts' && f.role !== 'sent' && f.path !== '[Gmail]')
    .filter((f) => !q || f.path.toLowerCase().includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 60)
  const pick = (id: number) => {
    const ids = moveFor || []
    close()
    void move(ids, id)
  }
  return (
    <Modal open={open} onClose={close} title={t('Move to folder')} width={460}>
      <div className="p-3">
        <div className="relative mb-2">
          <Search size={15} className="absolute left-3 top-2.5 text-muted" />
          <input
            autoFocus
            className={cx(inputCls, 'pl-9')}
            placeholder={t('Search folders…')}
            value={q}
            onChange={(e) => (setQ(e.target.value), setHi(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, list.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
              if (e.key === 'Enter' && list[hi]) pick(list[hi].id)
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {list.map((f, i) => (
            <button key={f.id} onMouseEnter={() => setHi(i)} onClick={() => pick(f.id)} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px]', i === hi ? 'bg-accent-soft text-accent' : 'hover:bg-hover')}>
              <FolderIcon size={14} className="text-muted" />
              <span className="flex-1 truncate">{f.path}</span>
              {accounts.length > 1 && <span className="truncate text-[11.5px] text-faint">{accounts.find((a) => a.id === f.account_id)?.email}</span>}
            </button>
          ))}
          {!list.length && <div className="p-3 text-center text-muted">{t('No folders')}</div>}
        </div>
      </div>
    </Modal>
  )
}

/** Gmail labels: add or remove a label on the conversations in `labelFor` (or create a new one). */
export function LabelPicker() {
  const { labelFor, folders, accounts, threads, toast, refreshList } = useStore()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const open = !!labelFor?.length
  const close = () => useStore.setState({ labelFor: null })
  useEffect(() => {
    setQ('')
    setHi(0)
  }, [open])
  const ids = labelFor || []
  const targets = ids.map((id) => threads.find((x) => x.thread_id === id)).filter((x) => !!x)
  // conversations missing from the loaded list: offer the labels of every Gmail account
  const accIds = new Set(targets.map((x) => x.account_id))
  const gmail = accounts.filter((a) => a.is_gmail && (accIds.size ? accIds.has(a.id) : true))
  const gmailIds = new Set(gmail.map((a) => a.id))
  const all = useMemo(() => {
    const names = new Set<string>()
    for (const th of threads) if (gmailIds.has(th.account_id)) th.labels.forEach((l) => names.add(l))
    for (const f of folders) {
      if (!gmailIds.has(f.account_id) || f.role) continue
      if (f.path === 'INBOX' || f.path.startsWith('[Gmail]') || f.path.startsWith('[Google Mail]')) continue
      names.add(f.path)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [open, threads, folders, accounts])
  const has = (label: string) => targets.length > 0 && targets.length === ids.length && targets.every((x) => x.labels.includes(label))
  const needle = q.trim().toLowerCase()
  const matches = all.filter((l) => !needle || l.toLowerCase().includes(needle)).slice(0, 80)
  const exact = all.some((l) => l.toLowerCase() === needle)
  const options: { label: string; create?: boolean }[] = [...(needle && !exact ? [{ label: q.trim(), create: true }] : []), ...matches.map((label) => ({ label }))]
  const pick = async (label: string, create = false) => {
    close()
    const on = create || !has(label)
    try {
      const r = await api.setLabel(ids, label, on)
      toast({ level: 'info', message: r.message || (on ? t('Label added') : t('Label removed')), undo: r.undo })
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
    }
    await refreshList(true)
  }
  return (
    <Modal open={open} onClose={close} title={t('Labels')} width={420}>
      <div className="p-3">
        {!gmail.length ? (
          <div className="p-3 text-center text-muted">{t('Labels are available for Gmail accounts.')}</div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-2.5 text-muted" />
              <input
                autoFocus
                className={cx(inputCls, 'pl-9')}
                placeholder={t('Find or create a label…')}
                value={q}
                onChange={(e) => (setQ(e.target.value), setHi(0))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, options.length - 1)))
                  if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
                  if (e.key === 'Enter' && options[hi]) void pick(options[hi].label, options[hi].create)
                }}
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {options.map((o, i) => (
                <button
                  key={(o.create ? '+' : '') + o.label}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => void pick(o.label, o.create)}
                  className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px]', i === hi ? 'bg-accent-soft text-accent' : 'hover:bg-hover')}
                >
                  {o.create ? <Plus size={14} className="text-muted" /> : <Tag size={14} className="text-muted" />}
                  <span className="flex-1 truncate">{o.create ? t('Create label “{name}”', { name: o.label }) : o.label}</span>
                  {!o.create && has(o.label) && <Check size={14} className="text-accent" />}
                </button>
              ))}
              {!options.length && <div className="p-3 text-center text-muted">{t('No labels yet — type a name to create one')}</div>}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
