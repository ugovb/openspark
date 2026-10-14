// Phone menu: a light list (inbox per account, folders with their colours, every account's folders)
// with a floating Settings button, the way phone mail apps lay it out.
import {
  AlarmClock, Archive, CalendarDays, ChevronLeft, ChevronUp, Clock, Coffee, Contact, FileEdit, Folder as FolderIcon, Inbox, Pin, Search, Send,
  ShieldQuestion, ThumbsDown, Trash2, FolderX,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import type { Account, FolderRole, MailboxRef } from '../../../shared/types'
import { useStore } from '../lib/store'
import { accountLabel, AllFoldersPanel } from './Sidebar'
import { cx } from './ui'
import { dateLocale, t } from '../../../shared/i18n'

const same = (a: MailboxRef, b: MailboxRef) => JSON.stringify(a) === JSON.stringify(b)

function useActive(ref: MailboxRef | undefined, account: number | null): boolean {
  const { mailbox, accountFilter, view } = useStore()
  return view === 'mail' && !!ref && same(mailbox, ref) && accountFilter === account
}

function Row({
  icon, label, sub, count, refTo, account = null, onClick, open, onToggle, indent, children,
}: {
  icon?: ReactNode; label: string; sub?: string; count?: number; refTo?: MailboxRef; account?: number | null; onClick?: () => void
  open?: boolean; onToggle?: () => void; indent?: boolean; children?: ReactNode
}) {
  const setMailbox = useStore((s) => s.setMailbox)
  const active = useActive(refTo, account)
  return (
    <>
      <div className={cx('mx-2 flex items-center rounded-2xl transition-colors', active ? 'bg-hover' : 'active:bg-hover')}>
        <button
          onClick={() => (onClick ? onClick() : refTo && setMailbox(refTo, account))}
          className={cx('flex min-h-[52px] min-w-0 flex-1 items-center gap-4 py-1.5 text-left', indent ? 'pl-12' : 'pl-3')}
        >
          {icon && <span className="flex w-7 shrink-0 justify-center">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className={cx('block truncate text-[17px]', active ? 'text-accent' : 'text-fg')}>{label}</span>
            {sub && <span className="block truncate text-[14px] text-muted">{sub}</span>}
          </span>
          {!!count && <span className="tabular mr-1 min-w-[26px] rounded-full bg-accent px-2 text-center text-[13px] font-medium leading-[24px] text-accent-fg">{count}</span>}
        </button>
        {onToggle && (
          <button aria-label={open ? t('Collapse') : t('Expand')} aria-expanded={open} onClick={onToggle} className="flex h-[52px] w-11 shrink-0 items-center justify-center text-faint">
            {open ? <ChevronUp size={19} /> : <ChevronLeft size={19} />}
          </button>
        )}
      </div>
      {open && children}
    </>
  )
}

function Bar({ a }: { a: Account }) {
  return <span className="h-4 w-[3px] rounded-full" style={{ background: a.color || 'var(--accent)' }} />
}

/** A folder kind that can be opened for all accounts at once or for one of them. */
function PerAccount({ icon, label, refTo, count }: { icon: ReactNode; label: string; refTo: MailboxRef; count?: number }) {
  const accounts = useStore((s) => s.accounts)
  const [open, setOpen] = useState(false)
  const many = accounts.length > 1
  return (
    <Row icon={icon} label={label} refTo={refTo} count={count} open={open} onToggle={many ? () => setOpen(!open) : undefined}>
      {accounts.map((a) => <Row key={a.id} indent icon={<Bar a={a} />} label={accountLabel(a)} refTo={refTo} account={a.id} />)}
    </Row>
  )
}

const ROLE_ORDER: FolderRole[] = ['inbox', 'flagged', 'drafts', 'sent', 'archive', 'all', 'junk', 'trash']

export default function PhoneDrawer() {
  const { accounts, folders, counts: c, settings, smartFolders, setView } = useStore()
  const [inboxOpen, setInboxOpen] = useState(true)
  const [accOpen, setAccOpen] = useState<Record<number, boolean>>({})
  const [edit, setEdit] = useState(false)
  const pinned = settings?.ui?.pinnedFolders || []
  const inboxUnread = (a: Account) => {
    const f = folders.find((x) => x.account_id === a.id && x.role === 'inbox')
    return f ? c?.folders[f.id] : undefined
  }
  const accountFolders = useMemo(() => {
    const m = new Map<number, typeof folders>()
    for (const a of accounts) {
      const list = folders.filter((f) => f.account_id === a.id && f.path !== '[Gmail]' && f.role !== 'important' && f.role !== 'blocked')
      const sys = list.filter((f) => f.role).sort((x, y) => ROLE_ORDER.indexOf(x.role!) - ROLE_ORDER.indexOf(y.role!))
      const user = list.filter((f) => !f.role).sort((x, y) => x.path.localeCompare(y.path, dateLocale()))
      m.set(a.id, [...sys, ...user])
    }
    return m
  }, [accounts, folders])

  return (
    <aside className="relative flex h-full w-[86vw] max-w-[360px] flex-col bg-panel text-fg">
      <nav className="min-h-0 flex-1 overflow-y-auto pb-28 pt-4">
        <Row
          icon={<Inbox size={24} className="text-accent" strokeWidth={1.75} />}
          label={t('Inbox')}
          sub={accounts.length > 1 ? t('All accounts') : undefined}
          refTo={{ kind: 'smart' }}
          count={c?.inboxUnread}
          open={inboxOpen}
          onToggle={accounts.length > 1 ? () => setInboxOpen(!inboxOpen) : undefined}
        >
          {accounts.map((a) => <Row key={a.id} indent icon={<Bar a={a} />} label={accountLabel(a)} refTo={{ kind: 'smart' }} account={a.id} count={inboxUnread(a)} />)}
        </Row>
        {!!c?.newsenders && <Row icon={<ShieldQuestion size={24} className="text-warning" strokeWidth={1.75} />} label={t('New senders')} count={c.newsenders} refTo={{ kind: 'newsenders' }} />}

        <div className="px-5 pb-1 pt-5 text-[15px] text-muted">{t('Folders')}</div>
        <PerAccount icon={<Send size={23} strokeWidth={1.75} />} label={t('Sent')} refTo={{ kind: 'unified', role: 'sent' }} />
        <Row icon={<FileEdit size={23} className="text-muted" strokeWidth={1.75} />} label={t('Drafts')} refTo={{ kind: 'local-drafts' }} />
        <PerAccount icon={<Pin size={23} className="text-pin" strokeWidth={1.75} />} label={t('Pins')} refTo={{ kind: 'pinned' }} />
        <PerAccount icon={<Archive size={23} className="text-success" strokeWidth={1.75} />} label={t('Archive')} refTo={{ kind: 'unified', role: 'archive' }} />
        <PerAccount icon={<Trash2 size={23} className="text-danger" strokeWidth={1.75} />} label={t('Trash')} refTo={{ kind: 'unified', role: 'trash' }} />
        <PerAccount icon={<FolderX size={23} className="text-muted" strokeWidth={1.75} />} label={t('Spam')} refTo={{ kind: 'unified', role: 'junk' }} />
        <Row icon={<ThumbsDown size={23} className="text-danger" strokeWidth={1.75} />} label={t('Blocked')} refTo={{ kind: 'blocked' }} />
        <Row icon={<AlarmClock size={23} className="text-violet" strokeWidth={1.75} />} label={t('Reminders')} refTo={{ kind: 'reminders' }} count={c?.reminders} />
        <Row icon={<Clock size={23} className="text-warning" strokeWidth={1.75} />} label={t('Snoozed')} refTo={{ kind: 'snoozed' }} />
        <Row icon={<Coffee size={23} className="text-newsletter" strokeWidth={1.75} />} label={t('Set Aside')} refTo={{ kind: 'setaside' }} />
        <Row icon={<Send size={23} className="text-notification" strokeWidth={1.75} />} label={t('Scheduled')} refTo={{ kind: 'scheduled' }} count={c?.scheduled} />
        {smartFolders.map((sf) => <Row key={`s${sf.id}`} icon={<Search size={22} className="text-folder" strokeWidth={1.75} />} label={sf.name} refTo={{ kind: 'smartfolder', id: sf.id }} />)}
        {pinned.map((id) => {
          const f = folders.find((x) => x.id === id)
          return f ? <Row key={`p${id}`} icon={<FolderIcon size={23} className="text-folder" strokeWidth={1.75} />} label={f.name} refTo={{ kind: 'folder', folderId: f.id }} count={c?.folders[f.id]} /> : null
        })}
        <button onClick={() => setEdit(true)} className="ml-[68px] mt-2 py-2 text-[17px] text-accent">{t('Edit list')}</button>

        <div className="mt-6" />
        {accounts.map((a) => (
          <Row
            key={a.id}
            icon={<Inbox size={24} strokeWidth={2} style={{ color: a.color || 'var(--accent)', fill: `color-mix(in srgb, ${a.color || 'var(--accent)'} 85%, transparent)` }} />}
            label={a.email}
            sub={a.name && a.name !== a.email.split('@')[0] ? a.name : undefined}
            refTo={{ kind: 'smart' }}
            account={a.id}
            open={!!accOpen[a.id]}
            onToggle={() => setAccOpen({ ...accOpen, [a.id]: !accOpen[a.id] })}
          >
            {(accountFolders.get(a.id) || []).map((f) => (
              <Row key={f.id} indent icon={<FolderIcon size={18} className="text-folder" strokeWidth={1.75} />} label={f.name} refTo={{ kind: 'folder', folderId: f.id }} count={f.role === 'inbox' ? undefined : c?.folders[f.id]} />
            ))}
          </Row>
        ))}
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6" style={{ background: 'linear-gradient(to top, var(--panel) 55%, transparent)' }}>
        <button onClick={() => setView('settings')} className="pointer-events-auto h-14 rounded-full bg-surface px-7 text-[18px] font-semibold active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          {t('Settings')}
        </button>
        <span className="flex-1" />
        <button aria-label={t('Contacts')} onClick={() => setView('contacts')} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <Contact size={21} />
        </button>
        <button aria-label={t('Calendar')} onClick={() => setView('calendar')} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted active:scale-95" style={{ boxShadow: 'var(--shadow)' }}>
          <CalendarDays size={21} />
        </button>
      </div>
      {edit && <AllFoldersPanel onClose={() => setEdit(false)} />}
    </aside>
  )
}
