import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlarmClock, ArrowLeft, Bell, BellOff, Check, ChevronDown, ChevronRight, Circle, Clock, Coffee, Command, Flag, FolderInput, Inbox, MailOpen,
  Mail, MoreHorizontal, Newspaper, Paperclip, PenLine, Pin, PinOff, RefreshCw, Search, ShieldCheck, ShieldX, Star, Tag, Trash2,
  TriangleAlert, Users, X, Zap,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Category, ThreadSummary } from '../../../shared/types'
import { api } from '../lib/api'
import { dayHeader, displayName, listDate } from '../lib/format'
import { useNarrow } from '../lib/narrow'
import { useSwipe } from '../lib/swipe'
import { useOnePane, useStore } from '../lib/store'
import { extraThreadItems } from '../lib/thread-actions'
import DraftList from './DraftList'
import DrawerButton from './DrawerButton'
import { MailboxEmpty } from './EmptyState'
import { Avatar, cx, IconButton, Menu, type MenuItem, RoundCheck, Spinner, Tip, TipButton } from './ui'
import { t, tp } from '../../../shared/i18n'

type Row =
  | { kind: 'header'; key: string; label: string; count?: number }
  | { kind: 'thread'; key: string; t: ThreadSummary; nested?: boolean }
  | { kind: 'group'; key: string; category: Category; threads: ThreadSummary[] }
  | { kind: 'banner'; key: string; count: number }

const CAT_META: Record<Category, { label: string; icon: React.ReactNode; color: string }> = {
  people: { label: t('People'), icon: <Users size={14} />, color: 'var(--people)' },
  notification: { label: t('Notifications'), icon: <Bell size={14} />, color: 'var(--notification)' },
  newsletter: { label: t('Newsletters'), icon: <Newspaper size={14} />, color: 'var(--newsletter)' },
}

function buildRows(threads: ThreadSummary[], smart: boolean, groupCats: Set<Category>, expanded: Set<Category>, newSenders: number): Row[] {
  const rows: Row[] = []
  if (newSenders > 0) rows.push({ kind: 'banner', key: 'banner', count: newSenders })
  let rest = threads
  if (smart) {
    const top = threads.filter((t) => t.pinned || t.priority)
    if (top.length) {
      rows.push({ kind: 'header', key: 'h-top', label: t('Priority & pinned'), count: top.length })
      for (const t of top) rows.push({ kind: 'thread', key: `t${t.thread_id}`, t })
    }
    rest = threads.filter((t) => !t.pinned && !t.priority)
  }
  const placed = new Set<Category>()
  let lastHeader = ''
  for (const t of rest) {
    const h = dayHeader(t.last_date)
    const cat = (t.category || 'people') as Category
    if (smart && groupCats.has(cat)) {
      if (placed.has(cat)) continue
      placed.add(cat)
      if (h !== lastHeader) {
        rows.push({ kind: 'header', key: `h-${h}`, label: h })
        lastHeader = h
      }
      const members = rest.filter((x) => (x.category || 'people') === cat)
      rows.push({ kind: 'group', key: `g-${cat}`, category: cat, threads: members })
      if (expanded.has(cat)) for (const m of members) rows.push({ kind: 'thread', key: `t${m.thread_id}`, t: m, nested: true })
      continue
    }
    if (h !== lastHeader) {
      rows.push({ kind: 'header', key: `h-${h}`, label: h })
      lastHeader = h
    }
    rows.push({ kind: 'thread', key: `t${t.thread_id}`, t })
  }
  return rows
}

export function useMailboxTitle(): { title: string; subtitle: string } {
  const { mailbox, folders, smartFolders, accounts, accountFilter, settings } = useStore()
  const acc = accounts.find((a) => a.id === accountFilter)
  const sub = acc ? acc.email : accounts.length > 1 ? t('All accounts') : ''
  switch (mailbox.kind) {
    case 'smart': return { title: t('Inbox'), subtitle: acc ? acc.email : settings?.smartInbox === false ? sub : t('Smart Inbox') }
    case 'category': return { title: CAT_META[mailbox.category].label, subtitle: t('Inbox') }
    case 'unified': return { title: ({ inbox: t('Inbox'), sent: t('Sent'), drafts: t('Drafts (server)'), archive: t('Archive'), trash: t('Trash'), junk: t('Spam'), all: t('All mail') } as Record<string, string>)[mailbox.role] || mailbox.role, subtitle: sub }
    case 'folder': {
      const f = folders.find((x) => x.id === mailbox.folderId)
      const a = accounts.find((x) => x.id === f?.account_id)
      return { title: f?.name || t('Folder'), subtitle: a?.email || '' }
    }
    case 'pinned': return { title: t('Pins'), subtitle: sub }
    case 'snoozed': return { title: t('Snoozed'), subtitle: sub }
    case 'setaside': return { title: t('Set Aside'), subtitle: sub }
    case 'reminders': return { title: t('Reminders'), subtitle: sub }
    case 'newsenders': return { title: t('New senders'), subtitle: t('Gatekeeper') }
    case 'blocked': return { title: t('Blocked senders'), subtitle: '' }
    case 'scheduled': return { title: t('Scheduled to send'), subtitle: '' }
    case 'local-drafts': return { title: t('Drafts'), subtitle: '' }
    case 'search': return { title: mailbox.query, subtitle: t('Search results') }
    case 'smartfolder': return { title: smartFolders.find((s) => s.id === mailbox.id)?.name || t('Smart folder'), subtitle: t('Smart folder') }
  }
}

type Variant = 'wide' | 'stack'

/** Actions shown in place of the date when the pointer is over a row. */
function HoverActions({ th, onMore }: { th: ThreadSummary; onMore: (e: React.MouseEvent) => void }) {
  const act = useStore((s) => s.act)
  const gmail = useStore((s) => s.accounts.find((a) => a.id === th.account_id)?.is_gmail)
  const ids = [th.thread_id]
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <TipButton size="sm" label={th.priority ? t('Remove priority') : t('Mark as priority')} kbd="P" active={th.priority} onClick={() => void act(th.priority ? 'unpriority' : 'priority', ids)}><Zap size={15} /></TipButton>
      <TipButton size="sm" label={th.unread ? t('Mark as read') : t('Mark as unread')} kbd="U" onClick={() => void act(th.unread ? 'read' : 'unread', ids)}>{th.unread ? <MailOpen size={15} /> : <Circle size={15} />}</TipButton>
      <TipButton size="sm" label={th.pinned ? t('Unpin') : t('Pin')} kbd="S" active={th.pinned} onClick={() => void act(th.pinned ? 'unpin' : 'pin', ids)}>{th.pinned ? <PinOff size={15} /> : <Pin size={15} />}</TipButton>
      {gmail && <TipButton size="sm" label={t('Add a label')} kbd="L" onClick={() => useStore.setState({ labelFor: ids })}><Tag size={15} /></TipButton>}
      <TipButton size="sm" label={t('Move to Trash')} kbd="#" onClick={() => void act('trash', ids)}><Trash2 size={15} /></TipButton>
      <TipButton size="sm" label={t('Snooze')} kbd="H" onClick={() => useStore.setState({ snoozeFor: ids, pickerMode: 'snooze' })}><Clock size={15} /></TipButton>
      <TipButton size="sm" label={th.set_aside ? t('Back to Inbox') : t('Set aside')} kbd="Y" active={th.set_aside} onClick={() => void act(th.set_aside ? 'unaside' : 'aside', ids)}><Coffee size={15} /></TipButton>
      <TipButton size="sm" label={t('More')} onClick={onMore}><MoreHorizontal size={15} /></TipButton>
    </div>
  )
}

/** Phone swipe actions (Settings → Swipes). */
const SWIPE: Record<string, { color: string; icon: React.ReactNode; label: (th: ThreadSummary) => string }> = {
  archive: { color: 'var(--success)', icon: <Check size={20} />, label: () => t('Done') },
  trash: { color: 'var(--danger)', icon: <Trash2 size={20} />, label: () => t('Trash') },
  pin: { color: 'var(--pin)', icon: <Pin size={20} />, label: (th) => (th.pinned ? t('Unpin') : t('Pin')) },
  snooze: { color: 'var(--warning)', icon: <Clock size={20} />, label: () => t('Snooze') },
  read: { color: 'var(--accent)', icon: <MailOpen size={20} />, label: (th) => (th.unread ? t('Read') : t('Unread')) },
  aside: { color: 'var(--newsletter)', icon: <Coffee size={20} />, label: (th) => (th.set_aside ? t('Back to Inbox') : t('Set aside')) },
  priority: { color: 'var(--notification)', icon: <Zap size={20} />, label: (th) => (th.priority ? t('Remove priority') : t('Priority')) },
}

function runSwipe(action: string, th: ThreadSummary) {
  const { act } = useStore.getState()
  const ids = [th.thread_id]
  switch (action) {
    case 'archive': return void act('archive', ids)
    case 'trash': return void act('trash', ids)
    case 'pin': return void act(th.pinned ? 'unpin' : 'pin', ids)
    case 'snooze': return useStore.setState({ snoozeFor: ids, pickerMode: 'snooze' })
    case 'read': return void act(th.unread ? 'read' : 'unread', ids)
    case 'aside': return void act(th.set_aside ? 'unaside' : 'aside', ids)
    case 'priority': return void act(th.priority ? 'unpriority' : 'priority', ids)
  }
}

function names(th: ThreadSummary): string {
  return th.participants.length > 1 && th.message_count > 1
    ? th.participants.slice(-3).map((p) => (p.name === 'Ja' || p.name === t('Me') ? t('Me') : displayName(p).split(' ')[0])).join(', ')
    : displayName(th.from)
}

function Chips({ th }: { th: ThreadSummary }) {
  if (!(th.snoozed_until || th.reminder_at || th.is_new_sender || th.labels.length > 0 || th.resurfaced_at)) return null
  return (
    <>
      {th.snoozed_until && <Chip icon={<Clock size={11} />}>{new Date(th.snoozed_until).getFullYear() > 9000 ? t('someday') : listDate(th.snoozed_until)}</Chip>}
      {th.reminder_at && <Chip icon={<AlarmClock size={11} />}>{listDate(th.reminder_at)}</Chip>}
      {th.resurfaced_at && !th.snoozed_until && <Chip icon={<AlarmClock size={11} />} tone="accent">{t('back')}</Chip>}
      {th.is_new_sender && <Chip icon={<ShieldCheck size={11} />} tone="warn">{t('new sender')}</Chip>}
      {th.labels.slice(0, 3).map((l) => <Chip key={l}>{l}</Chip>)}
    </>
  )
}

const ThreadRow = memo(function ThreadRow({
  t: th, selected, checked, nested, compact, variant, doneIsUndo, swipe, onOpen, onCheck, onMenu,
}: {
  t: ThreadSummary; selected: boolean; checked: boolean; nested?: boolean; compact: boolean; variant: Variant; doneIsUndo: boolean
  swipe?: { left: string; right: string }
  onOpen: (t: ThreadSummary, e: React.MouseEvent) => void; onCheck: (t: ThreadSummary, e: React.MouseEvent) => void; onMenu: (t: ThreadSummary, e: React.MouseEvent) => void
}) {
  const act = useStore((s) => s.act)
  const showAccount = useStore((s) => s.accounts.length > 1)
  const done = () => void act(doneIsUndo ? 'moveToInbox' : 'archive', [th.thread_id])
  const highlighted = selected || checked
  const sw = useSwipe({
    enabled: !!swipe,
    onLeft: swipe && SWIPE[swipe.left] ? () => runSwipe(swipe.left, th) : undefined,
    onRight: swipe && SWIPE[swipe.right] ? () => runSwipe(swipe.right, th) : undefined,
    onLong: () => useStore.getState().toggleCheck(th.thread_id),
  })

  if (variant === 'wide') {
    return (
      <div
        onClick={(e) => onOpen(th, e)}
        onContextMenu={(e) => onMenu(th, e)}
        className={cx(
          'group relative mx-4 flex h-9 cursor-default items-center gap-3 rounded-xl pl-2 pr-3 transition-colors',
          nested && 'ml-10',
          highlighted ? 'bg-row-hover' : 'hover:bg-row-hover',
        )}
      >
        <div className="relative flex w-[22px] shrink-0 justify-center">
          {th.unread && <span className={cx('h-2 w-2 rounded-full bg-accent', 'group-hover:hidden', highlighted && 'hidden')} />}
          <span className={cx('absolute inset-0 items-center justify-center', highlighted ? 'flex' : 'hidden group-hover:flex')}>
            <RoundCheck label={doneIsUndo ? t('Not done') : t('Done')} kbd="E" done={doneIsUndo} onClick={done} />
          </span>
        </div>
        <span onClick={(e) => (e.stopPropagation(), onCheck(th, e))} className="rounded-full" style={{ boxShadow: `0 0 0 2px var(--surface), 0 0 0 3.5px ${th.account_color && showAccount ? th.account_color : 'transparent'}` }}>
          {checked ? (
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent text-accent-fg"><Check size={14} /></span>
          ) : (
            <Avatar addr={th.from} size={26} />
          )}
        </span>
        <span className={cx('w-[210px] shrink-0 truncate text-[13.5px]', th.unread ? 'font-semibold text-fg' : 'text-fg/85')}>{names(th)}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cx('max-w-[46%] shrink-0 truncate text-[13.5px]', th.unread ? 'font-medium text-fg' : 'text-fg/90')}>{th.subject || t('(no subject)')}</span>
          {th.message_count > 1 && <span className="tabular shrink-0 rounded-md bg-surface-2 px-1.5 text-[11px] text-muted">{th.message_count}</span>}
          {th.has_draft && <span className="shrink-0 text-[11.5px] font-medium text-danger">{t('Draft')}</span>}
          {th.has_attachments && <Paperclip size={13} className="shrink-0 text-faint" />}
          {th.muted && <BellOff size={12.5} className="shrink-0 text-faint" />}
          <Chips th={th} />
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{th.snippet}</span>
        </span>
        <span className="relative flex shrink-0 items-center justify-end">
          {th.pinned && <Pin size={12.5} className="mr-2 fill-current text-pin group-hover:hidden" />}
          <span className={cx('tabular w-14 text-right text-[12px] group-hover:hidden', th.unread ? 'font-semibold text-fg' : 'text-muted')}>{listDate(th.last_date)}</span>
          <span className="hidden group-hover:flex">
            <HoverActions th={th} onMore={(e) => onMenu(th, e)} />
          </span>
        </span>
      </div>
    )
  }

  const left = swipe ? SWIPE[swipe.left] : undefined
  const right = swipe ? SWIPE[swipe.right] : undefined
  const shown = sw.dx > 0 ? right : sw.dx < 0 ? left : undefined
  return (
    <div className={cx('relative mx-2 overflow-hidden rounded-xl', nested && 'ml-6')}>
      {shown && (
        <div
          className={cx('absolute inset-0 flex items-center px-6 text-white transition-opacity', sw.dx > 0 ? 'justify-start' : 'justify-end', !sw.armed && 'opacity-60')}
          style={{ background: shown.color }}
        >
          <span className="flex flex-col items-center gap-0.5 text-[11px] font-medium">{shown.icon}{shown.label(th)}</span>
        </div>
      )}
    <div
      {...sw.handlers}
      onClick={(e) => onOpen(th, e)}
      onContextMenu={(e) => onMenu(th, e)}
      style={{ transform: sw.dx ? `translateX(${sw.dx}px)` : undefined, touchAction: swipe ? 'pan-y' : undefined }}
      className={cx(
        'group relative flex cursor-default gap-3 rounded-xl px-3',
        sw.dx ? '' : 'transition-[transform,background-color] duration-200',
        compact ? 'py-2' : 'py-2.5',
        highlighted ? 'bg-row-hover' : 'bg-surface hover:bg-row-hover',
      )}
    >
      {th.unread && <span className="absolute left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent" />}
      <div className="mt-0.5" onClick={(e) => (e.stopPropagation(), onCheck(th, e))}>
        {checked ? (
          <div className={cx('flex items-center justify-center rounded-full bg-accent text-accent-fg', compact ? 'h-8 w-8' : 'h-10 w-10')}><Check size={17} /></div>
        ) : (
          <Avatar addr={th.from} size={compact ? 32 : 40} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {showAccount && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: th.account_color || 'var(--accent)' }} title={th.account_email} />}
          <span className={cx('truncate text-[14px]', th.unread ? 'font-semibold text-fg' : 'text-fg/85')}>{names(th)}</span>
          {th.message_count > 1 && <span className="tabular text-[11.5px] text-faint">{th.message_count}</span>}
          {th.has_draft && <span className="text-[11.5px] font-medium text-danger">{t('Draft')}</span>}
          <span className="flex-1" />
          {th.has_attachments && <Paperclip size={12.5} className="text-faint" />}
          {th.pinned && <Pin size={12.5} className="fill-current text-pin" />}
          {th.muted && <BellOff size={12.5} className="text-faint" />}
          <span className={cx('tabular shrink-0 text-[12px]', th.unread ? 'font-semibold text-accent' : 'text-muted')}>{listDate(th.last_date)}</span>
        </div>
        <div className={cx('truncate text-[13.5px]', th.unread ? 'font-medium text-fg' : 'text-fg/80')}>{th.subject || t('(no subject)')}</div>
        {!compact && <div className="line-clamp-1 text-[13px] text-muted">{th.snippet || ' '}</div>}
        <div className="mt-1 flex flex-wrap gap-1 empty:hidden"><Chips th={th} /></div>
      </div>
    </div>
    </div>
  )
})

function Chip({ children, icon, tone }: { children: React.ReactNode; icon?: React.ReactNode; tone?: 'warn' | 'accent' }) {
  return (
    <span className={cx(
      'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[1px] text-[11px]',
      tone === 'warn' ? 'bg-warning/15 text-warning' : tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
    )}>
      {icon}
      {children}
    </span>
  )
}

function GroupRow({ category, threads, expanded, variant, onToggle }: { category: Category; threads: ThreadSummary[]; expanded: boolean; variant: Variant; onToggle: () => void }) {
  const act = useStore((s) => s.act)
  const meta = CAT_META[category]
  const unread = threads.filter((t) => t.unread).length
  const senders = useMemo(() => {
    const m = new Map<string, { th: ThreadSummary; n: number; unread: boolean }>()
    for (const th of threads) {
      const k = th.from.email.toLowerCase()
      const cur = m.get(k)
      if (cur) (cur.n++, (cur.unread ||= th.unread))
      else m.set(k, { th, n: 1, unread: th.unread })
    }
    return [...m.values()].slice(0, 4)
  }, [threads])
  const doneAll = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void act('archive', threads.map((t) => t.thread_id))
      }}
      className="hidden h-7 shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2.5 text-[12px] font-medium text-accent hover:bg-accent hover:text-accent-fg group-hover:flex"
    >
      <Check size={13} /> {t('Done ({n})', { n: threads.length })}
    </button>
  )
  const chevron = expanded ? <ChevronDown size={15} className="shrink-0 text-faint" /> : <ChevronRight size={15} className="shrink-0 text-faint" />

  if (variant === 'wide') {
    return (
      <div onClick={onToggle} className="group mx-4 flex h-9 cursor-default items-center gap-3 rounded-xl pl-2 pr-3 hover:bg-row-hover">
        <span className="flex w-[22px] shrink-0 justify-center">{unread > 0 && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>{meta.icon}</span>
        <span className="flex w-[210px] shrink-0 items-baseline gap-1.5">
          <span className={cx('truncate text-[13.5px]', unread ? 'font-semibold' : '')}>{meta.label}</span>
          <span className="tabular text-[11px] text-faint">{threads.length}</span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
          {senders.map(({ th, n, unread: u }) => (
            <span key={th.thread_id} className="flex shrink-0 items-center gap-1.5 text-[13.5px]">
              {u && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              <Avatar addr={th.from} size={16} />
              <span className={cx('max-w-[160px] truncate', u ? 'font-medium' : 'text-fg/85')}>{displayName(th.from)}</span>
              {n > 1 && <span className="tabular text-[11px] text-faint">{n}</span>}
            </span>
          ))}
        </span>
        {doneAll}
        {chevron}
      </div>
    )
  }

  return (
    <div onClick={onToggle} className="group mx-2 flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-row-hover">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>{meta.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cx('text-[14px]', unread ? 'font-semibold' : '')}>{meta.label}</span>
          <span className="tabular text-[11.5px] text-faint">{threads.length}</span>
          {unread > 0 && <span className="text-[11.5px] font-medium text-accent">{tp(unread, '{n} new', '{n} new')}</span>}
        </div>
        <div className="truncate text-[13px] text-muted">{senders.map((x) => displayName(x.th.from)).join(', ')}</div>
      </div>
      {doneAll}
      {chevron}
    </div>
  )
}

/** Title row of the mail list: back, title and subtitle, search and compose. */
function ListHeader({ loading, bulk, scrolled }: { loading: boolean; bulk: React.ReactNode; scrolled: boolean }) {
  const { mailbox, accountFilter, accounts, setMailbox, setView, compose, refreshList } = useStore()
  const narrow = useNarrow()
  const { title, subtitle } = useMailboxTitle()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const home = mailbox.kind === 'smart' && accountFilter === null
  const trashLike = mailbox.kind === 'unified' && (mailbox.role === 'trash' || mailbox.role === 'junk')
  const inboxItems: MenuItem[] = [
    { label: t('All accounts'), icon: <Inbox size={14} />, onClick: () => setMailbox({ kind: 'smart' }) },
    ...accounts.map((a) => ({ label: a.email, icon: <span className="h-2 w-2 rounded-full" style={{ background: a.color || 'var(--accent)' }} />, onClick: () => setMailbox({ kind: 'smart' }, a.id) })),
  ]
  const empty = async () => {
    const all = await api.listThreads(mailbox, { accountId: accountFilter, limit: 10000 })
    if (!all.length) return
    if (!window.confirm(tp(all.length, 'Delete {n} conversation forever?', 'Delete {n} conversations forever?'))) return
    await useStore.getState().act('deleteForever', all.map((x) => x.thread_id))
  }
  if (narrow) {
    // phone: compact bar, large title underneath that folds into the bar while scrolling
    return (
      <header className="shrink-0 bg-surface">
        <div className="flex h-12 items-center gap-1 px-2">
          <DrawerButton />
          {!home && <IconButton aria-label={t('Back to Inbox')} onClick={() => setMailbox({ kind: 'smart' })}><ArrowLeft size={18} /></IconButton>}
          <span className={cx('min-w-0 flex-1 truncate text-center text-[16px] font-semibold transition-opacity duration-200', scrolled || bulk ? 'opacity-100' : 'opacity-0')}>{bulk ? '' : title}</span>
          {bulk || (
            <>
              {loading && <Spinner className="text-muted" />}
              {trashLike && <button onClick={() => void empty()} className="rounded-full px-2 py-1 text-[13px] font-medium text-danger">{t('Empty')}</button>}
              <span className="w-10" />
            </>
          )}
        </div>
        <div className={cx('overflow-hidden px-4 transition-[max-height,opacity] duration-200', scrolled ? 'max-h-0 opacity-0' : 'max-h-20 pb-2 opacity-100')}>
          <button
            onClick={(e) => mailbox.kind === 'smart' && accounts.length > 1 && setMenu({ x: e.clientX, y: e.clientY + 14 })}
            className="flex max-w-full items-center gap-1 text-left text-[30px] font-bold leading-tight tracking-tight"
          >
            <span className="truncate">{title}</span>
            {mailbox.kind === 'smart' && accounts.length > 1 && <ChevronDown size={20} className="shrink-0 text-muted" />}
          </button>
          {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
        </div>
        <Menu items={inboxItems} anchor={menu} onClose={() => setMenu(null)} />
      </header>
    )
  }
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2 px-6 pt-2">
      <DrawerButton />
      {!home && !narrow && (
        <Tip label={t('Back to Inbox')} kbd="G I">
          <button aria-label={t('Back to Inbox')} onClick={() => setMailbox({ kind: 'smart' })} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-hover hover:text-fg">
            <ArrowLeft size={15} />
          </button>
        </Tip>
      )}
      <div className={cx('min-w-0', !narrow && 'pl-3')}>
        <button
          onClick={(e) => mailbox.kind === 'smart' && accounts.length > 1 && setMenu({ x: e.clientX, y: e.clientY + 14 })}
          className="flex max-w-full items-center gap-1 truncate text-left text-[15px] font-semibold"
        >
          <span className="truncate">{title}</span>
          {mailbox.kind === 'smart' && accounts.length > 1 && <ChevronDown size={14} className="shrink-0 text-muted" />}
        </button>
        {subtitle && <div className="truncate text-[12px] text-muted">{subtitle}</div>}
      </div>
      {trashLike && (
        <button onClick={() => void empty()} className="ml-4 shrink-0 rounded-full px-2 py-1 text-[12.5px] font-medium text-danger hover:bg-danger/10">
          {t('Empty')}
        </button>
      )}
      <span className="flex-1" />
      {bulk}
      {loading && <Spinner className="text-muted" />}
      {!narrow && <TipButton label={t('Refresh')} onClick={() => void refreshList(true)}><RefreshCw size={16} /></TipButton>}
      {!narrow && <TipButton label={t('Commands')} kbd="Ctrl K" onClick={() => useStore.setState({ palette: true })}><Command size={16} /></TipButton>}
      <TipButton label={t('Search')} kbd="/" onClick={() => setView('search')}><Search size={17} /></TipButton>
      {!narrow && <TipButton label={t('New message')} kbd="C" onClick={() => compose({ mode: 'new' })}><PenLine size={17} /></TipButton>}
      <Menu items={inboxItems} anchor={menu} onClose={() => setMenu(null)} />
    </header>
  )
}

export default function ThreadList() {
  const s = useStore()
  const { threads, loading, hasMore, selected, checked, mailbox, settings, counts, loadMore, select, toggleCheck, act, clearChecks } = s
  const one = useOnePane()
  const narrow = useNarrow()
  const variant: Variant = one && !narrow ? 'wide' : 'stack'
  const parentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<Set<Category>>(new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; t: ThreadSummary } | null>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => setScrolled(false), [mailbox])
  const smart = mailbox.kind === 'smart' && settings?.smartInbox !== false
  const doneIsUndo = mailbox.kind === 'unified' && (mailbox.role === 'archive' || mailbox.role === 'trash')
  const groupCats = useMemo(() => {
    const g = new Set<Category>()
    if (smart && settings?.groupNotifications !== false) g.add('notification')
    if (smart && settings?.groupNewsletters !== false) g.add('newsletter')
    return g
  }, [smart, settings])
  const rows = useMemo(
    () => buildRows(threads, smart, groupCats, expanded, smart && settings?.gatekeeper === 'on' ? counts?.newsenders || 0 : 0),
    [threads, smart, groupCats, expanded, settings?.gatekeeper, counts?.newsenders],
  )
  const compact = settings?.density === 'compact'
  const swipe = useMemo(() => (narrow && settings ? { left: settings.swipeLeft, right: settings.swipeRight } : undefined), [narrow, settings?.swipeLeft, settings?.swipeRight])
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].kind === 'header' ? 34 : rows[i].kind === 'banner' ? 52 : variant === 'wide' ? 36 : compact ? 58 : 80),
    overscan: 12,
    getItemKey: (i) => rows[i].key,
  })

  useEffect(() => {
    const items = virt.getVirtualItems()
    const last = items[items.length - 1]
    if (last && last.index >= rows.length - 8 && !loading && rows.length > 0) void loadMore()
  }, [virt.getVirtualItems(), rows.length, loading, hasMore])

  // keep the selected row visible when navigating with the keyboard
  useEffect(() => {
    if (!selected) return
    const idx = rows.findIndex((r) => r.kind === 'thread' && r.t.thread_id === selected)
    if (idx >= 0) virt.scrollToIndex(idx, { align: 'auto' })
  }, [selected])

  if (mailbox.kind === 'scheduled' || mailbox.kind === 'local-drafts') return <DraftList kind={mailbox.kind} />

  const open = (t: ThreadSummary, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) toggleCheck(t.thread_id, e.shiftKey)
    else {
      clearChecks()
      select(t.thread_id)
    }
  }

  const menuItems = (th: ThreadSummary): MenuItem[] => {
    const ids = checked.includes(th.thread_id) ? checked : [th.thread_id]
    const emails = [th.from.email]
    return [
      { label: doneIsUndo ? t('Not done') : t('Done'), icon: <Check size={14} />, hint: 'E', onClick: () => void act(doneIsUndo ? 'moveToInbox' : 'archive', ids) },
      { label: th.unread ? t('Mark as read') : t('Mark as unread'), icon: th.unread ? <MailOpen size={14} /> : <Mail size={14} />, hint: 'U', onClick: () => void act(th.unread ? 'read' : 'unread', ids) },
      { label: th.pinned ? t('Unpin') : t('Pin'), icon: <Pin size={14} />, hint: 'S', onClick: () => void act(th.pinned ? 'unpin' : 'pin', ids) },
      { label: t('Snooze…'), icon: <Clock size={14} />, hint: 'H', onClick: () => useStore.setState({ snoozeFor: ids, pickerMode: 'snooze' }) },
      { label: th.set_aside ? t('Back to Inbox') : t('Set aside'), icon: <Coffee size={14} />, hint: 'Y', onClick: () => void act(th.set_aside ? 'unaside' : 'aside', ids) },
      { label: th.priority ? t('Remove priority') : t('Mark as priority'), icon: <Star size={14} />, hint: 'P', onClick: () => void act(th.priority ? 'unpriority' : 'priority', ids) },
      { label: th.muted ? t('Unmute conversation') : t('Mute conversation'), icon: <BellOff size={14} />, hint: 'M', onClick: () => void act(th.muted ? 'unmute' : 'mute', ids) },
      { label: t('Move to folder…'), icon: <FolderInput size={14} />, hint: 'V', onClick: () => useStore.setState({ moveFor: ids }) },
      ...(s.accounts.find((a) => a.id === th.account_id)?.is_gmail ? [{ label: t('Add a label'), icon: <Tag size={14} />, hint: 'L', onClick: () => useStore.setState({ labelFor: ids }) }] : []),
      { label: t('Move to Inbox'), icon: <Inbox size={14} />, onClick: () => void act('moveToInbox', ids) },
      { separator: true, label: '' },
      ...extraThreadItems(th),
      { separator: true, label: '' },
      { label: t('Sender → People'), icon: <Users size={14} />, onClick: () => void s.categorize(emails, 'people') },
      { label: t('Sender → Notifications'), icon: <Bell size={14} />, onClick: () => void s.categorize(emails, 'notification') },
      { label: t('Sender → Newsletters'), icon: <Newspaper size={14} />, onClick: () => void s.categorize(emails, 'newsletter') },
      { label: t('Priority sender'), icon: <Flag size={14} />, onClick: () => void s.senders('vip', emails) },
      { label: t('Accept sender'), icon: <ShieldCheck size={14} />, onClick: () => void s.senders('accept', emails) },
      { label: t('Block {email}', { email: th.from.email }), icon: <ShieldX size={14} />, danger: true, onClick: () => void s.senders('block', emails) },
      { separator: true, label: '' },
      { label: t('Unsubscribe from list'), icon: <X size={14} />, onClick: () => void act('unsubscribe', ids) },
      { label: t('Spam'), icon: <TriangleAlert size={14} />, onClick: () => void act('spam', ids) },
      { label: t('Move to Trash'), icon: <Trash2 size={14} />, hint: '#', danger: true, onClick: () => void act('trash', ids) },
      ...(mailbox.kind === 'unified' && (mailbox.role === 'trash' || mailbox.role === 'junk')
        ? [{ label: t('Delete forever'), icon: <Trash2 size={14} />, danger: true, onClick: () => void act('deleteForever', ids) }]
        : []),
    ]
  }

  const bulk = checked.length > 0 && (
    <div className="anim-in flex items-center gap-0.5 rounded-full bg-accent-soft py-0.5 pl-3 pr-1">
      <span className="tabular pr-1.5 text-[12.5px] font-medium text-accent">{t('Selected: {n}', { n: checked.length })}</span>
      <TipButton size="sm" label={t('Done')} kbd="E" onClick={() => void act('archive')}><Check size={15} /></TipButton>
      <TipButton size="sm" label={t('Mark read')} onClick={() => void act('read')}><MailOpen size={15} /></TipButton>
      <TipButton size="sm" label={t('Pin')} onClick={() => void act('pin')}><Pin size={15} /></TipButton>
      <TipButton size="sm" label={t('Snooze')} onClick={() => useStore.setState({ snoozeFor: checked, pickerMode: 'snooze' })}><Clock size={15} /></TipButton>
      <TipButton size="sm" label={t('Move')} onClick={() => useStore.setState({ moveFor: checked })}><FolderInput size={15} /></TipButton>
      <TipButton size="sm" label={t('Move to Trash')} onClick={() => void act('trash')}><Trash2 size={15} /></TipButton>
      <IconButton size="sm" aria-label={t('Clear selection')} title={t('Clear selection')} onClick={clearChecks}><X size={15} /></IconButton>
    </div>
  )

  return (
    <section className={cx('flex h-full shrink-0 flex-col bg-surface', one ? 'min-w-0 flex-1' : 'w-[420px] border-r border-line')}>
      <ListHeader loading={loading} bulk={bulk} scrolled={scrolled} />
      <div ref={parentRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)} className={cx('min-h-0 flex-1 overflow-y-auto', rows.length > 0 && 'pb-24')}>
        {!loading && rows.length === 0 ? (
          <MailboxEmpty />
        ) : (
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((vi) => {
              const r = rows[vi.index]
              return (
                <div key={vi.key} data-index={vi.index} ref={virt.measureElement} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
                  {r.kind === 'header' && (
                    <div className={cx('flex h-[34px] items-end pb-1.5 text-[12.5px] text-muted', variant === 'wide' ? 'pl-[54px]' : 'pl-5')}>
                      {r.label}
                      {r.count ? <span className="tabular ml-1.5 text-faint">{r.count}</span> : null}
                    </div>
                  )}
                  {r.kind === 'banner' && (
                    <button onClick={() => s.setMailbox({ kind: 'newsenders' })} className="mx-4 mb-1 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-warning/10 px-4 py-3 text-left hover:bg-warning/15">
                      <ShieldCheck size={18} className="text-warning" />
                      <span className="flex-1 text-[13px]"><b>{r.count}</b> {tp(r.count, 'new sender is waiting for your decision', 'new senders are waiting for your decision')}</span>
                      <ChevronRight size={15} className="text-muted" />
                    </button>
                  )}
                  {r.kind === 'group' && (
                    <GroupRow
                      category={r.category}
                      threads={r.threads}
                      variant={variant}
                      expanded={expanded.has(r.category)}
                      onToggle={() => {
                        const n = new Set(expanded)
                        if (n.has(r.category)) n.delete(r.category)
                        else n.add(r.category)
                        setExpanded(n)
                      }}
                    />
                  )}
                  {r.kind === 'thread' && (
                    <ThreadRow
                      t={r.t}
                      nested={r.nested}
                      compact={compact}
                      variant={variant}
                      doneIsUndo={doneIsUndo}
                      swipe={swipe}
                      selected={selected === r.t.thread_id}
                      checked={checked.includes(r.t.thread_id)}
                      onOpen={open}
                      onCheck={(t, e) => toggleCheck(t.thread_id, e.shiftKey)}
                      onMenu={(t, e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenu({ x: e.clientX, y: e.clientY, t })
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="flex justify-center p-8 text-muted"><Spinner /></div>
        )}
      </div>
      <Menu items={menu ? menuItems(menu.t) : []} anchor={menu ? { x: menu.x, y: menu.y } : null} onClose={() => setMenu(null)} />
    </section>
  )
}
