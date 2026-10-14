import {
  AlarmClock, AppWindow, Archive, BellOff, Bot, CalendarDays, Check, Clock, Coffee, Contact, FileText, Flag, Folder, FolderInput, Forward, Group,
  Inbox, Link, Link2, Mail, MailMinus, MailOpen, Moon, Newspaper, PenSquare, Pin, PinOff, Printer, RefreshCw, Repeat, Reply, ReplyAll, Search,
  Send, Settings, ShieldCheck, ShieldX, Star, Sun, Tag, Trash2, TriangleAlert, UserCheck, UserSearch, Users, Bell, BookmarkPlus, Zap,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MailboxRef, ThreadSummary } from '../../../shared/types'
import { api } from '../lib/api'
import { type ThreadAction, useStore } from '../lib/store'
import {
  canSendAgain, copyThreadHyperlink, copyThreadLink, copyThreadMarkdown, groupBySender, openInNewWindow, printThread, searchBySender, sendAgain,
} from '../lib/thread-actions'
import { askText, cx } from './ui'
import { t } from '../../../shared/i18n'

interface Cmd {
  id: string
  label: string
  /** keyboard shortcut */
  hint?: string
  /** extra detail shown as plain text (e.g. the account of a folder) */
  note?: string
  keywords: string
  group: string
  icon?: ReactNode
  run: () => void
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
}

function score(q: string, c: Cmd): number {
  const hay = norm(`${c.label} ${c.keywords}`)
  const words = norm(q).split(/\s+/).filter(Boolean)
  let s = 0
  for (const w of words) {
    const i = hay.indexOf(w)
    if (i < 0) return -1
    s += i === 0 ? 3 : hay[i - 1] === ' ' ? 2 : 1
  }
  return s
}

const I = 15

export default function CommandPalette() {
  const st = useStore()
  const { palette, folders, accounts, smartFolders, selected, threads, settings, checked, mailbox, standalone } = st
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  // the selected conversation may not be in the loaded list (conversation window, deep link)
  const [loaded, setLoaded] = useState<ThreadSummary | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const close = () => useStore.setState({ palette: false })
  useEffect(() => {
    setQ('')
    setHi(0)
  }, [palette])
  useEffect(() => {
    setLoaded(null)
    if (!palette || !selected || threads.some((x) => x.thread_id === selected)) return
    void api.getThread(selected).then((tv) => tv && useStore.getState().selected === selected && setLoaded(tv.thread)).catch(() => undefined)
  }, [palette, selected])

  const cmds = useMemo<Cmd[]>(() => {
    const MSG = t('Message')
    const go = (label: string, ref: MailboxRef, icon: ReactNode, keywords = '', hint?: string): Cmd => ({
      id: `go-${label}`, label: t('Go to: {name}', { name: label }), hint, icon, keywords: `idz przejdz go ${keywords}`, group: t('Navigation'), run: () => st.setMailbox(ref),
    })
    const act = (id: ThreadAction, label: string, icon: ReactNode, keywords: string, hint?: string): Cmd => ({ id, label, hint, icon, keywords, group: MSG, run: () => void st.act(id) })
    const th = threads.find((x) => x.thread_id === selected) || (loaded?.thread_id === selected ? loaded : undefined)
    const targets = st.targets()
    const list: Cmd[] = []

    // ---- message actions first, in the order people reach for them ----
    if (targets.length) {
      const gmail = accounts.some((a) => a.is_gmail && (th ? a.id === th.account_id : threads.some((x) => targets.includes(x.thread_id) && x.account_id === a.id)))
      list.push(act('trash', t('Move to Trash'), <Trash2 size={I} />, 'delete usun trash bin kosz', '#'))
      if (th) list.push(th.unread ? act('read', t('Mark as read'), <MailOpen size={I} />, 'read seen przeczytane', 'U') : act('unread', t('Mark as unread'), <Mail size={I} />, 'unread nieprzeczytane', 'U'))
      else list.push(act('read', t('Mark as read'), <MailOpen size={I} />, 'read seen przeczytane'), act('unread', t('Mark as unread'), <Mail size={I} />, 'unread nieprzeczytane', 'U'))
      if (th && canSendAgain(th)) list.push({ id: 'again', label: t('Send again'), icon: <Repeat size={I} />, keywords: 'send again resend wyslij ponownie', group: MSG, run: () => void sendAgain(th.thread_id) })
      list.push(act('archive', t('Done'), <Check size={I} />, 'done archive archiwizuj zrobione', 'E'))
      if (th) {
        const last = th.latest_message_id
        list.push(
          { id: 'replyall', label: t('Reply all'), hint: 'A', icon: <ReplyAll size={I} />, keywords: 'reply all odpowiedz wszystkim', group: MSG, run: () => st.compose({ mode: 'replyall', messageId: last, threadId: th.thread_id }) },
          { id: 'reply', label: t('Reply'), hint: 'R', icon: <Reply size={I} />, keywords: 'reply odpowiedz', group: MSG, run: () => st.compose({ mode: 'reply', messageId: last, threadId: th.thread_id }) },
          { id: 'forward', label: t('Forward'), hint: 'F', icon: <Forward size={I} />, keywords: 'forward przekaz', group: MSG, run: () => st.compose({ mode: 'forward', messageId: last, threadId: th.thread_id }) },
        )
      }
      list.push(
        th?.pinned ? act('unpin', t('Unpin'), <PinOff size={I} />, 'unpin odepnij', 'S') : act('pin', t('Pin'), <Pin size={I} />, 'pin star flag gwiazdka przypnij', 'S'),
        { id: 'snooze', label: t('Snooze…'), hint: 'H', icon: <Clock size={I} />, keywords: 'snooze pozniej odloz read later', group: MSG, run: () => useStore.setState({ snoozeFor: targets, pickerMode: 'snooze' }) },
        { id: 'move', label: t('Move to…'), hint: 'V', icon: <FolderInput size={I} />, keywords: 'move folder przenies', group: MSG, run: () => useStore.setState({ moveFor: targets }) },
        th?.set_aside ? act('unaside', t('Back to Inbox'), <Coffee size={I} />, 'set aside odloz', 'Y') : act('aside', t('Set aside'), <Coffee size={I} />, 'set aside odloz', 'Y'),
      )
      if (gmail) list.push({ id: 'label', label: t('Add a label'), hint: 'L', icon: <Tag size={I} />, keywords: 'label tag etykieta gmail', group: MSG, run: () => useStore.setState({ labelFor: targets }) })
      list.push(
        th?.priority ? act('unpriority', t('Remove priority'), <Star size={I} />, 'priority wazne', 'P') : act('priority', t('Mark as priority'), <Star size={I} />, 'priority wazne', 'P'),
        act('spam', t('Mark as spam'), <TriangleAlert size={I} />, 'spam junk', '!'),
        act('moveToInbox', t('Move to Inbox'), <Inbox size={I} />, 'inbox restore przywroc'),
      )
      if (th) {
        list.push(
          { id: 'print', label: t('Print…'), icon: <Printer size={I} />, keywords: 'print drukuj', group: MSG, run: () => void printThread(th.thread_id) },
          { id: 'copylink', label: t('Copy link'), icon: <Link size={I} />, keywords: 'copy link url kopiuj', group: MSG, run: () => void copyThreadLink(th.thread_id) },
          { id: 'copymd', label: t('Copy as Markdown'), icon: <FileText size={I} />, keywords: 'copy markdown md kopiuj', group: MSG, run: () => void copyThreadMarkdown(th.thread_id) },
          { id: 'copyhl', label: t('Copy hyperlink to this conversation'), icon: <Link2 size={I} />, keywords: 'copy hyperlink link markdown kopiuj', group: MSG, run: () => void copyThreadHyperlink(th) },
        )
        if (!standalone) {
          list.push(
            { id: 'bysender', label: t('Search emails by sender'), icon: <UserSearch size={I} />, keywords: `search sender szukaj od ${th.from.email}`, group: MSG, run: () => searchBySender(th.from.email) },
            { id: 'groupsender', label: t('Group emails by sender'), icon: <Group size={I} />, keywords: `group sender smart folder grupuj ${th.from.email}`, group: MSG, run: () => void groupBySender(th.from) },
            { id: 'window', label: t('Open in a new window'), icon: <AppWindow size={I} />, keywords: 'open new window okno', group: MSG, run: () => openInNewWindow(th.thread_id) },
          )
        }
      }
      list.push(
        { id: 'remind', label: t('Remind me…'), icon: <AlarmClock size={I} />, keywords: 'remind follow up przypomnienie', group: MSG, run: () => useStore.setState({ snoozeFor: targets, pickerMode: 'remind' }) },
        th?.muted ? act('unmute', t('Unmute conversation'), <BellOff size={I} />, 'unmute', 'M') : act('mute', t('Mute conversation'), <BellOff size={I} />, 'mute cisza', 'M'),
        act('unsubscribe', t('Unsubscribe from newsletter'), <MailMinus size={I} />, 'unsubscribe wypisz'),
      )
    }

    // a conversation window offers only what concerns its conversation
    if (standalone) return list

    // ---- navigation ----
    list.push(
      go('Smart Inbox', { kind: 'smart' }, <Inbox size={I} />, 'inbox odebrane skrzynka', 'G I'),
      go(t('Pinned'), { kind: 'pinned' }, <Pin size={I} />, 'pinned star', 'G P'),
      go(t('Snoozed'), { kind: 'snoozed' }, <Clock size={I} />, 'snoozed', 'G Z'),
      go(t('Set Aside'), { kind: 'setaside' }, <Coffee size={I} />, 'set aside'),
      go(t('Reminders'), { kind: 'reminders' }, <AlarmClock size={I} />, 'reminders'),
      go(t('Scheduled'), { kind: 'scheduled' }, <Send size={I} />, 'scheduled send later outbox'),
      go(t('Drafts'), { kind: 'local-drafts' }, <FileText size={I} />, 'drafts szkice', 'G D'),
      go(t('New senders'), { kind: 'newsenders' }, <ShieldCheck size={I} />, 'gatekeeper new senders', 'G N'),
      go(t('Sent'), { kind: 'unified', role: 'sent' }, <Send size={I} />, 'sent', 'G S'),
      go(t('Archive'), { kind: 'unified', role: 'archive' }, <Archive size={I} />, 'archive done zrobione', 'G A'),
      go(t('Trash'), { kind: 'unified', role: 'trash' }, <Trash2 size={I} />, 'trash bin', 'G T'),
      go(t('Spam'), { kind: 'unified', role: 'junk' }, <TriangleAlert size={I} />, 'junk'),
      go(t('Newsletters'), { kind: 'category', category: 'newsletter' }, <Newspaper size={I} />, 'newsletter'),
      go(t('Notifications'), { kind: 'category', category: 'notification' }, <Bell size={I} />, 'notifications'),
      go(t('People'), { kind: 'category', category: 'people' }, <Users size={I} />, 'people'),
      ...smartFolders.map((sf) => go(sf.name, { kind: 'smartfolder', id: sf.id }, <Search size={I} />, 'smart folder')),
    )

    // ---- general ----
    const G = t('General')
    list.push(
      { id: 'compose', label: t('New message'), hint: 'C', icon: <PenSquare size={I} />, keywords: 'napisz utworz compose new email mail', group: G, run: () => st.compose({ mode: 'new' }) },
      {
        id: 'search', label: t('Search mail'), hint: '/', icon: <Search size={I} />, keywords: 'znajdz search find szukaj', group: G,
        run: () => (useStore.getState().view === 'search' ? document.getElementById('octo-search')?.focus() : st.setView('search')),
      },
      { id: 'ask', label: t('Ask AI about your mail'), icon: <Bot size={I} />, keywords: 'asystent ai ask pytanie', group: G, run: () => st.setView('ask') },
      { id: 'sync', label: t('Sync now'), icon: <RefreshCw size={I} />, keywords: 'pobierz odswiez fetch refresh', group: G, run: () => void api.syncNow() },
      { id: 'cal', label: t('Open calendar'), hint: 'G C', icon: <CalendarDays size={I} />, keywords: 'calendar wydarzenia spotkania', group: G, run: () => st.setView('calendar') },
      { id: 'contacts', label: t('Open contacts'), icon: <Contact size={I} />, keywords: 'contacts ludzie adresy', group: G, run: () => st.setView('contacts') },
      { id: 'settings', label: t('Settings'), icon: <Settings size={I} />, keywords: 'preferences opcje settings ustawienia', group: G, run: () => st.setView('settings') },
      {
        id: 'theme', label: settings?.theme === 'dark' ? t('Light theme') : t('Dark theme'), icon: settings?.theme === 'dark' ? <Sun size={I} /> : <Moon size={I} />,
        keywords: 'dark light theme tryb motyw', group: G, run: () => void st.updateSettings({ theme: settings?.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'gk', label: settings?.gatekeeper === 'on' ? t('Turn off Gatekeeper') : t('Turn on Gatekeeper (new senders wait for approval)'), icon: <ShieldCheck size={I} />,
        keywords: 'gatekeeper nowi nadawcy screening', group: G, run: () => void st.updateSettings({ gatekeeper: settings?.gatekeeper === 'on' ? 'off' : 'on' }),
      },
      {
        id: 'savesearch', label: t('Save search as a smart folder'), icon: <BookmarkPlus size={I} />, keywords: 'smart folder zapisz', group: G,
        run: async () => {
          const query = st.searchQuery || (await askText(t('Query (e.g. from:boss@company.com has:attachment)')))
          if (!query) return
          const name = await askText(t('Smart folder name'), query)
          if (name) await api.saveSmartFolder({ name, query })
          void st.refreshMeta()
        },
      },
    )

    // ---- the sender of the selected conversation ----
    if (th) {
      const S = t('Sender')
      const email = th.from.email
      const domain = email.split('@')[1]
      list.push(
        { id: 'accept', label: t('Accept sender {email}', { email }), icon: <UserCheck size={I} />, keywords: 'accept sender akceptuj', group: S, run: () => void st.senders('accept', [email]) },
        { id: 'block', label: t('Block sender {email}', { email }), icon: <ShieldX size={I} />, keywords: 'block sender blokuj', group: S, run: () => void st.senders('block', [email]) },
        { id: 'blockdomain', label: t('Block domain @{domain}', { domain }), icon: <ShieldX size={I} />, keywords: 'block domain blokuj domene', group: S, run: () => void st.senders('block', ['@' + domain]) },
        { id: 'vip', label: t('Priority sender: {email}', { email }), icon: <Flag size={I} />, keywords: 'vip priority sender', group: S, run: () => void st.senders('vip', [email]) },
        { id: 'cat-p', label: t('Change sender category → People'), icon: <Users size={I} />, keywords: 'change category people', group: S, run: () => void st.categorize([email], 'people') },
        { id: 'cat-n', label: t('Change sender category → Notifications'), icon: <Bell size={I} />, keywords: 'change category notifications', group: S, run: () => void st.categorize([email], 'notification') },
        { id: 'cat-l', label: t('Change sender category → Newsletters'), icon: <Newspaper size={I} />, keywords: 'change category newsletter', group: S, run: () => void st.categorize([email], 'newsletter') },
      )
    }

    // ---- folders ----
    list.push(
      ...folders.filter((f) => !f.role).map((f) => ({
        id: `f-${f.id}`, label: t('Folder: {path}', { path: f.path }), note: accounts.length > 1 ? accounts.find((a) => a.id === f.account_id)?.email : undefined,
        icon: <Folder size={I} />, keywords: `folder ${f.name}`, group: t('Folders'), run: () => st.setMailbox({ kind: 'folder', folderId: f.id }),
      })),
    )
    return list
  }, [palette, selected, loaded, checked, threads, folders, smartFolders, settings, accounts, mailbox, standalone])

  const results = useMemo(() => {
    if (!q.trim()) return cmds.slice(0, 300)
    const scored = cmds.map((c) => ({ c, s: score(q, c) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.c)
    if (!standalone) scored.push({ id: 'search-q', label: t('Search: {query}', { query: q }), icon: <Search size={I} />, keywords: '', group: t('Search'), run: () => st.setMailbox({ kind: 'search', query: q }) })
    return scored.slice(0, 60)
  }, [q, cmds])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [hi, results])

  if (!palette) return null
  const run = (c: Cmd) => {
    close()
    c.run()
  }
  const grouped = !q.trim()
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={close}>
      <div
        role="dialog"
        aria-label={t('Actions')}
        className="anim-in w-[560px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl bg-palette text-palette-fg"
        style={{ boxShadow: 'var(--shadow)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-1.5 pt-3 text-[12px] font-medium text-palette-fg/70">
          <Zap size={13} /> {t('Actions')}
        </div>
        <div className="mx-4 border-b border-palette-fg/20">
          <input
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setHi(0))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, results.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
              if (e.key === 'Enter' && results[hi]) run(results[hi])
            }}
            placeholder={t('Type a command or “go to”…')}
            className="h-11 w-full bg-transparent text-[15px] text-palette-fg outline-none placeholder:text-palette-fg/50 focus-visible:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto px-2 py-2">
          {results.map((c, i) => (
            <div key={c.id}>
              {grouped && c.group !== results[i - 1]?.group && (
                <div className={cx('px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-palette-fg/55', i === 0 ? 'pt-1' : 'pt-3')}>{c.group}</div>
              )}
              <button
                data-active={i === hi}
                onMouseMove={() => i !== hi && setHi(i)}
                onClick={() => run(c)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left text-[13.5px]', i === hi && 'bg-palette-active')}
              >
                <span className="flex w-4 shrink-0 justify-center text-palette-fg/80">{c.icon}</span>
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.note && <span className="max-w-[45%] shrink truncate text-[11.5px] text-palette-fg/55">{c.note}</span>}
                {c.hint && <span className="shrink-0 rounded-md bg-palette-fg/15 px-1.5 py-px font-mono text-[11px] text-palette-fg/85">{c.hint}</span>}
              </button>
            </div>
          ))}
          {!results.length && <div className="px-3 py-6 text-center text-[13px] text-palette-fg/60">{t('No matching actions')}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
