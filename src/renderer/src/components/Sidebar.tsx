import {
  AlarmClock, Archive, Ban, Bell, BookmarkPlus, CalendarDays, ChevronDown, ChevronRight, Clock, Coffee, Contact, FileEdit, Folder as FolderIcon,
  Inbox, Menu as MenuIcon, MoreHorizontal, Newspaper, PanelLeftClose, Pin, PinOff, Plus, RefreshCw, Search, Send, Settings, ShieldQuestion, UserRound,
  Sparkles, Trash2, TriangleAlert, Users, X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { Account, Folder, MailboxRef } from '../../../shared/types'
import { api } from '../lib/api'
import { useNarrow } from '../lib/narrow'
import PhoneDrawer from './PhoneDrawer'
import { setUi, useStore } from '../lib/store'
import { askText, cx, Menu, type MenuItem, Spinner, Tip } from './ui'
import { dateLocale, t } from '../../../shared/i18n'

function sameRef(a: MailboxRef, b: MailboxRef): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function useIsActive(refTo: MailboxRef | undefined, accountFilter: number | null): boolean {
  const { mailbox, accountFilter: af, view } = useStore()
  return (view === 'mail' || view === 'search') && !!refTo && sameRef(mailbox, refTo) && af === accountFilter
}

/** The rest of the code passes a folder's role to these labels/icons. */
const ROLE_ICON: Record<string, ReactNode> = {
  inbox: <Inbox size={15} />, sent: <Send size={15} />, drafts: <FileEdit size={15} />, archive: <Archive size={15} />,
  all: <Archive size={15} />, trash: <Trash2 size={15} />, junk: <TriangleAlert size={15} />, blocked: <Ban size={15} />,
  flagged: <Pin size={15} />, important: <Bell size={15} />,
}
const ROLE_LABEL: Record<string, string> = {
  inbox: t('Inbox'), sent: t('Sent'), drafts: t('Drafts'), archive: t('Archive'), all: t('All mail'), trash: t('Trash'),
  junk: t('Spam'), blocked: t('Blocked'), flagged: t('Flagged'), important: t('Important'),
}

function AccountDot({ a, size = 16 }: { a: Account; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: a.color || 'var(--accent)', fontSize: size * 0.5 }}
    >
      {(a.name || a.email).charAt(0).toUpperCase()}
    </span>
  )
}

export const accountLabel = (a: Account) => (a.name && a.name !== a.email.split('@')[0] ? a.name : a.email)

// ---------- expanded sidebar (dark column) ----------

function Item({
  icon, label, count, refTo, accountFilter = null, onClick, active, onContext, expand, indent, right,
}: {
  icon: ReactNode; label: string; count?: number; refTo?: MailboxRef; accountFilter?: number | null; onClick?: () => void
  active?: boolean; onContext?: (e: React.MouseEvent) => void; expand?: { open: boolean; toggle: () => void }; indent?: boolean; right?: ReactNode
}) {
  const setMailbox = useStore((s) => s.setMailbox)
  const routeActive = useIsActive(refTo, accountFilter)
  const isActive = active ?? routeActive
  return (
    <div className={cx('group relative flex items-center', indent && 'pl-5')}>
      {expand && (
        <button
          aria-label={expand.open ? t('Collapse') : t('Expand')}
          aria-expanded={expand.open}
          onClick={expand.toggle}
          className="absolute -left-0.5 flex h-8 w-4 items-center justify-center text-rail-faint hover:text-rail-fg"
        >
          {expand.open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
      <button
        onClick={() => (onClick ? onClick() : refTo && setMailbox(refTo, accountFilter))}
        onContextMenu={onContext}
        className={cx(
          'ml-3 flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] transition-colors',
          isActive ? 'bg-accent text-accent-fg' : 'text-rail-fg hover:bg-rail-hover',
        )}
      >
        <span className={cx('flex w-4 shrink-0 justify-center', !isActive && 'text-rail-faint')}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {!!count && <span className={cx('tabular text-[11.5px]', isActive ? 'text-accent-fg/85' : 'text-rail-faint')}>{count}</span>}
      </button>
      {right}
    </div>
  )
}

function Heading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-4 flex items-center px-5 pb-1 text-[12px] text-rail-faint">
      <span className="flex-1">{children}</span>
      {right}
    </div>
  )
}

/** Per-account children of Inbox / Pins / Sent / Trash / Archive. */
function AccountChildren({ refTo, count }: { refTo: MailboxRef; count?: (a: Account) => number | undefined }) {
  const accounts = useStore((s) => s.accounts)
  if (accounts.length < 2) return null
  return (
    <>
      {accounts.map((a) => (
        <Item key={a.id} indent icon={<AccountDot a={a} />} label={accountLabel(a)} refTo={refTo} accountFilter={a.id} count={count?.(a)} />
      ))}
    </>
  )
}

function useOpen(key: string, initial = false): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(`octo.sb.${key}`)
      return v === null ? initial : v === '1'
    } catch {
      return initial
    }
  })
  return {
    open,
    toggle: () => {
      setOpen(!open)
      try {
        localStorage.setItem(`octo.sb.${key}`, open ? '0' : '1')
      } catch {
        /* private mode */
      }
    },
  }
}

function FullSidebar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { accounts, folders, counts: c, smartFolders, settings, sync, view, setView, server } = useStore()
  const narrow = useNarrow()
  const syncing = Object.values(sync).some((s) => s.state === 'syncing' || s.state === 'connecting')
  const errors = Object.values(sync).filter((s) => s.state === 'error')
  const inboxOpen = useOpen('inbox', true)
  const pinsOpen = useOpen('pins')
  const sentOpen = useOpen('sent')
  const trashOpen = useOpen('trash')
  const archiveOpen = useOpen('archive')
  const pinned = settings?.ui?.pinnedFolders || []
  const inboxUnread = (a: Account) => {
    const f = folders.find((x) => x.account_id === a.id && x.role === 'inbox')
    return f ? c?.folders[f.id] : undefined
  }
  const many = accounts.length > 1

  return (
    <aside className="flex h-full w-[256px] shrink-0 flex-col bg-rail text-rail-fg max-md:w-[84vw] max-md:max-w-[320px]">
      <div className="flex h-11 shrink-0 items-center justify-end gap-1 px-2">
        <Tip label={t('Sync now')}>
          <button aria-label={t('Sync now')} onClick={() => void api.syncNow().catch(() => undefined)} className="flex h-8 w-8 items-center justify-center rounded-lg text-rail-faint hover:bg-rail-hover hover:text-rail-fg">
            {syncing ? <Spinner /> : <RefreshCw size={15} />}
          </button>
        </Tip>
        {!narrow && (
          <Tip label={t('Collapse sidebar')}>
            <button aria-label={t('Collapse sidebar')} onClick={() => setUi({ sidebar: 'rail' })} className="flex h-8 w-8 items-center justify-center rounded-lg text-rail-faint hover:bg-rail-hover hover:text-rail-fg">
              <PanelLeftClose size={16} />
            </button>
          </Tip>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-3 pr-2">
        <Item
          icon={<Inbox size={15} />}
          label={t('Inbox')}
          count={c?.inboxUnread}
          refTo={{ kind: 'smart' }}
          expand={inboxOpen}
        />
        {inboxOpen.open && (
          <>
            <AccountChildren refTo={{ kind: 'smart' }} count={inboxUnread} />
            {settings?.smartInbox !== false && (
              <>
                <Item indent icon={<Users size={14} />} label={t('People')} count={c?.categories.people} refTo={{ kind: 'category', category: 'people' }} />
                <Item indent icon={<Bell size={14} />} label={t('Notifications')} count={c?.categories.notification} refTo={{ kind: 'category', category: 'notification' }} />
                <Item indent icon={<Newspaper size={14} />} label={t('Newsletters')} count={c?.categories.newsletter} refTo={{ kind: 'category', category: 'newsletter' }} />
              </>
            )}
          </>
        )}
        {!!c?.newsenders && <Item icon={<ShieldQuestion size={15} />} label={t('New senders')} count={c.newsenders} refTo={{ kind: 'newsenders' }} />}
        <Item icon={<Pin size={15} />} label={t('Pins')} count={c?.pinned} refTo={{ kind: 'pinned' }} expand={many ? pinsOpen : undefined} />
        {pinsOpen.open && <AccountChildren refTo={{ kind: 'pinned' }} />}
        <Item icon={<Send size={15} />} label={t('Sent')} refTo={{ kind: 'unified', role: 'sent' }} expand={many ? sentOpen : undefined} />
        {sentOpen.open && <AccountChildren refTo={{ kind: 'unified', role: 'sent' }} />}
        <Item icon={<Trash2 size={15} />} label={t('Trash')} refTo={{ kind: 'unified', role: 'trash' }} expand={many ? trashOpen : undefined} />
        {trashOpen.open && <AccountChildren refTo={{ kind: 'unified', role: 'trash' }} />}
        <Item icon={<FileEdit size={15} />} label={t('Drafts')} count={c?.drafts} refTo={{ kind: 'local-drafts' }} />
        <Item icon={<Archive size={15} />} label={t('Archive')} refTo={{ kind: 'unified', role: 'archive' }} expand={many ? archiveOpen : undefined} />
        {archiveOpen.open && <AccountChildren refTo={{ kind: 'unified', role: 'archive' }} />}

        <Heading>{t('Folders')}</Heading>
        <Item icon={<Clock size={15} />} label={t('Snoozed')} count={c?.snoozed} refTo={{ kind: 'snoozed' }} />
        <Item icon={<Coffee size={15} />} label={t('Set Aside')} count={c?.setaside} refTo={{ kind: 'setaside' }} />
        <Item icon={<AlarmClock size={15} />} label={t('Reminders')} count={c?.reminders} refTo={{ kind: 'reminders' }} />
        <Item icon={<Send size={15} />} label={t('Scheduled')} count={c?.scheduled} refTo={{ kind: 'scheduled' }} />
        <Item icon={<TriangleAlert size={15} />} label={t('Spam')} refTo={{ kind: 'unified', role: 'junk' }} />
        <Item icon={<Ban size={15} />} label={t('Blocked')} refTo={{ kind: 'blocked' }} />
        {smartFolders.map((sf) => (
          <Item key={`sf${sf.id}`} icon={<Search size={14} />} label={sf.name} refTo={{ kind: 'smartfolder', id: sf.id }} />
        ))}
        {pinned.map((id) => {
          const f = folders.find((x) => x.id === id)
          if (!f) return null
          const a = accounts.find((x) => x.id === f.account_id)
          return <Item key={`pf${id}`} icon={<FolderIcon size={15} />} label={many && a ? `${f.name} · ${accountLabel(a)}` : f.name} count={c?.folders[f.id]} refTo={{ kind: 'folder', folderId: f.id }} />
        })}
        <Item icon={<MoreHorizontal size={15} />} label={t('More')} onClick={onMore} active={moreOpen} />
      </nav>

      <div className="shrink-0 px-2 pb-2 pt-1">
        {server && !server.online && (
          <button onClick={() => setView('settings')} className="mb-1.5 flex w-full items-center gap-2 rounded-lg bg-warning/15 px-2.5 py-1.5 text-left text-[12px] text-warning" title={server.url}>
            <TriangleAlert size={14} /> <span className="truncate">{t('No connection to the home server')}</span>
          </button>
        )}
        {errors.length > 0 && (
          <button onClick={() => setView('settings')} className="mb-1.5 flex w-full items-center gap-2 rounded-lg bg-danger/15 px-2.5 py-1.5 text-left text-[12px] text-danger">
            <TriangleAlert size={14} /> <span className="truncate">{errors[0].email}: {errors[0].error}</span>
          </button>
        )}
        {server && <AccountChip onOpen={() => setView('settings')} />}
        <Item icon={<Sparkles size={15} />} label={t('Ask AI')} onClick={() => setView('ask')} active={view === 'ask'} />
        <Item icon={<CalendarDays size={15} />} label={t('Calendar')} onClick={() => setView('calendar')} active={view === 'calendar'} />
        <Item icon={<Contact size={15} />} label={t('Contacts')} onClick={() => setView('contacts')} active={view === 'contacts'} />
        <Item icon={<Settings size={15} />} label={t('Settings')} onClick={() => setView('settings')} active={view === 'settings'} />
      </div>
    </aside>
  )
}


/** The OpenMail account this app is signed in to (home server owner), shown above the shortcuts. */
function AccountChip({ onOpen }: { onOpen: () => void }) {
  const [email, setEmail] = useState('')
  useEffect(() => {
    void (window.octo.serverAccount('/api/account') as Promise<{ user?: { email: string } | null }>)
      .then((a) => setEmail(a.user?.email || ''))
      .catch(() => undefined)
  }, [])
  if (!email) return null
  return (
    <button onClick={onOpen} title={t('OpenMail account')} className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-muted hover:bg-hover">
      <UserRound size={14} /> <span className="truncate">{email}</span>
    </button>
  )
}

// ---------- "More": every folder of every account ----------

function FolderRow({ f, pinned }: { f: Folder; pinned: boolean }) {
  const counts = useStore((s) => s.counts)
  const toast = useStore((s) => s.toast)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const pins = useStore((s) => s.settings?.ui?.pinnedFolders || [])
  const items: MenuItem[] = [
    { label: t('Sync now'), icon: <RefreshCw size={14} />, onClick: () => void api.syncFolder(f.id) },
    { label: t('Always sync in the background'), onClick: () => void api.setFolderSync(f.id, 'always') },
    { label: t('Don’t sync'), onClick: () => void api.setFolderSync(f.id, 'never') },
    { separator: true, label: '' },
    {
      label: t('Rename…'), disabled: !!f.role,
      onClick: async () => {
        const name = await askText(t('New folder name'), f.name)
        if (name) void api.renameFolder(f.id, name).catch((e) => toast({ level: 'error', message: String(e) }))
      },
    },
    {
      label: t('Delete folder'), danger: true, disabled: !!f.role,
      onClick: () => {
        if (window.confirm(t('Delete the folder “{name}” and everything in it on the server?', { name: f.name }))) void api.deleteFolder(f.id).catch((e) => toast({ level: 'error', message: String(e) }))
      },
    },
  ]
  const depth = f.delimiter ? f.path.split(f.delimiter).length - 1 : 0
  return (
    <div style={{ paddingLeft: Math.min(depth, 4) * 12 }}>
      <Item
        icon={f.role ? ROLE_ICON[f.role] || <FolderIcon size={15} /> : <FolderIcon size={15} />}
        label={(f.role && ROLE_LABEL[f.role]) || f.name}
        count={counts?.folders[f.id]}
        refTo={{ kind: 'folder', folderId: f.id }}
        onContext={(e) => (e.preventDefault(), setMenu({ x: e.clientX, y: e.clientY }))}
        right={
          <Tip label={pinned ? t('Remove from the sidebar') : t('Add to the sidebar')} side="left">
            <button
              aria-label={pinned ? t('Remove from the sidebar') : t('Add to the sidebar')}
              onClick={() => setUi({ pinnedFolders: pinned ? pins.filter((x) => x !== f.id) : [...pins, f.id] })}
              className={cx('ml-1 flex h-7 w-7 items-center justify-center rounded-md text-rail-faint hover:bg-rail-hover hover:text-rail-fg', !pinned && 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
            >
              {pinned ? <PinOff size={13} /> : <Plus size={14} />}
            </button>
          </Tip>
        }
      />
      <Menu items={items} anchor={menu} onClose={() => setMenu(null)} />
    </div>
  )
}

export function AllFoldersPanel({ onClose }: { onClose: () => void }) {
  const { accounts, folders, smartFolders, settings, mailbox, toast } = useStore()
  const pins = settings?.ui?.pinnedFolders || []
  const byAccount = useMemo(() => {
    const roleOrder = ['inbox', 'flagged', 'drafts', 'sent', 'archive', 'all', 'junk', 'blocked', 'trash']
    return accounts.map((a) => {
      const list = folders.filter((f) => f.account_id === a.id && f.path !== '[Gmail]' && f.role !== 'important')
      const sys = list.filter((f) => f.role).sort((x, y) => roleOrder.indexOf(x.role!) - roleOrder.indexOf(y.role!))
      const user = list.filter((f) => !f.role).sort((x, y) => x.path.localeCompare(y.path, dateLocale()))
      return { a, folders: [...user, ...sys] }
    })
  }, [accounts, folders])
  const newSmartFolder = async () => {
    const query = mailbox.kind === 'search' ? mailbox.query : await askText(t('Search to save (e.g. from:alice has:attachment)'), '')
    if (!query) return
    const name = await askText(t('Smart folder name'), query)
    if (name) await api.saveSmartFolder({ name, query }).then(() => useStore.getState().refreshMeta())
  }
  return (
    <aside className="anim-in flex h-full w-[240px] shrink-0 flex-col border-l border-white/5 bg-rail-2 text-rail-fg max-md:fixed max-md:inset-0 max-md:z-50 max-md:w-full">
      <div className="flex h-11 shrink-0 items-center px-4">
        <span className="flex-1 text-[12px] text-rail-faint">{t('All folders')}</span>
        <button aria-label={t('Close')} onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-rail-faint hover:bg-rail-hover hover:text-rail-fg">
          <X size={15} />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto pb-3 pr-2">
        <Item icon={<AlarmClock size={15} />} label={t('Reminders')} refTo={{ kind: 'reminders' }} />
        <Item icon={<Send size={15} />} label={t('Scheduled')} refTo={{ kind: 'scheduled' }} />
        <Item icon={<ShieldQuestion size={15} />} label={t('New senders')} refTo={{ kind: 'newsenders' }} />
        <Item icon={<Ban size={15} />} label={t('Blocked senders')} refTo={{ kind: 'blocked' }} />
        <Heading
          right={
            <Tip label={t('New smart folder')} side="left">
              <button aria-label={t('New smart folder')} onClick={() => void newSmartFolder()} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-rail-hover hover:text-rail-fg">
                <Plus size={14} />
              </button>
            </Tip>
          }
        >
          {t('Smart folders')}
        </Heading>
        {smartFolders.map((sf) => (
          <Item
            key={sf.id}
            icon={<Search size={14} />}
            label={sf.name}
            refTo={{ kind: 'smartfolder', id: sf.id }}
            onContext={(e) => {
              e.preventDefault()
              if (window.confirm(t('Delete the smart folder “{name}”? (messages stay)', { name: sf.name }))) void api.deleteSmartFolder(sf.id).then(() => useStore.getState().refreshMeta())
            }}
          />
        ))}
        {byAccount.map(({ a, folders: list }) => (
          <div key={a.id}>
            <Heading
              right={
                <Tip label={t('New folder…')} side="left">
                  <button
                    aria-label={t('New folder…')}
                    onClick={async () => {
                      const name = await askText(t('New folder in {account}', { account: a.email }), '', t('Folder name'))
                      if (name) void api.createFolder(a.id, name).catch((e) => toast({ level: 'error', message: String(e) }))
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-rail-hover hover:text-rail-fg"
                  >
                    <BookmarkPlus size={13} />
                  </button>
                </Tip>
              }
            >
              <span className="flex items-center gap-2 text-rail-fg">
                <AccountDot a={a} size={16} /> <span className="truncate">{accountLabel(a)}</span>
              </span>
            </Heading>
            {list.map((f) => <FolderRow key={f.id} f={f} pinned={pins.includes(f.id)} />)}
          </div>
        ))}
      </nav>
      <div className="shrink-0 px-4 pb-3 text-[11.5px] leading-snug text-rail-faint">{t('Use + to add a folder to the sidebar.')}</div>
    </aside>
  )
}

// ---------- icon rail ----------

function RailButton({ label, kbd, active, onClick, children }: { label: string; kbd?: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tip label={label} kbd={kbd} side="right">
      <button
        aria-label={label}
        onClick={onClick}
        className={cx(
          'flex h-9 w-9 items-center justify-center rounded-[10px] transition-[background-color,color,transform] active:scale-95',
          active ? 'bg-accent text-accent-fg' : 'text-rail-faint hover:bg-rail-hover hover:text-rail-fg',
        )}
      >
        {children}
      </button>
    </Tip>
  )
}

function Rail({ onMore }: { onMore: () => void }) {
  const { setMailbox, setView, view, counts } = useStore()
  const at = (r: MailboxRef) => useIsActive(r, null)
  const inbox = at({ kind: 'smart' })
  const pins = at({ kind: 'pinned' })
  const sent = at({ kind: 'unified', role: 'sent' })
  const trash = at({ kind: 'unified', role: 'trash' })
  const drafts = at({ kind: 'local-drafts' })
  const archive = at({ kind: 'unified', role: 'archive' })
  return (
    <nav aria-label={t('Mailboxes')} className="flex h-full w-[60px] shrink-0 flex-col items-center gap-1 bg-rail py-3">
      <div className="relative">
        <RailButton label={t('Inbox')} kbd="G I" active={inbox} onClick={() => setMailbox({ kind: 'smart' })}><Inbox size={18} /></RailButton>
        {!!counts?.inboxUnread && !inbox && <span className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-rail" />}
      </div>
      <div className="h-3" />
      <RailButton label={t('Pins')} kbd="G P" active={pins} onClick={() => setMailbox({ kind: 'pinned' })}><Pin size={17} /></RailButton>
      <RailButton label={t('Sent')} kbd="G S" active={sent} onClick={() => setMailbox({ kind: 'unified', role: 'sent' })}><Send size={17} /></RailButton>
      <RailButton label={t('Trash')} kbd="G T" active={trash} onClick={() => setMailbox({ kind: 'unified', role: 'trash' })}><Trash2 size={17} /></RailButton>
      <RailButton label={t('Drafts')} kbd="G D" active={drafts} onClick={() => setMailbox({ kind: 'local-drafts' })}><FileEdit size={17} /></RailButton>
      <RailButton label={t('Archive')} kbd="G A" active={archive} onClick={() => setMailbox({ kind: 'unified', role: 'archive' })}><Archive size={17} /></RailButton>
      <RailButton label={t('Show sidebar')} onClick={() => setUi({ sidebar: 'full' })}><MenuIcon size={18} /></RailButton>
      <RailButton label={t('All folders')} onClick={onMore}><MoreHorizontal size={18} /></RailButton>
      <span className="flex-1" />
      <RailButton label={t('Ask AI')} active={view === 'ask'} onClick={() => setView('ask')}><Sparkles size={17} /></RailButton>
      <RailButton label={t('Calendar')} kbd="G C" active={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={17} /></RailButton>
      <RailButton label={t('Contacts')} active={view === 'contacts'} onClick={() => setView('contacts')}><Contact size={17} /></RailButton>
      <RailButton label={t('Settings')} active={view === 'settings'} onClick={() => setView('settings')}><Settings size={17} /></RailButton>
    </nav>
  )
}

export default function Sidebar() {
  const narrow = useNarrow()
  const mode = useStore((s) => s.settings?.ui?.sidebar || 'rail')
  const [more, setMore] = useState(false)
  const toggle = () => setMore(!more)
  if (narrow) return <PhoneDrawer />
  return (
    <div className="flex h-full shrink-0">
      {mode === 'full' ? <FullSidebar onMore={toggle} moreOpen={more} /> : <Rail onMore={toggle} />}
      {more && <AllFoldersPanel onClose={() => setMore(false)} />}
    </div>
  )
}
