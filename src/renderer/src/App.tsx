import { PenSquare } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import CommandPalette from './components/CommandPalette'
import Composer from './components/Composer'
import { MovePicker, SnoozePicker } from './components/Pickers'
import Sidebar from './components/Sidebar'
import ThreadList from './components/ThreadList'
import ThreadView from './components/ThreadView'
import Toasts from './components/Toasts'
import { PromptHost, Spinner } from './components/ui'
import { api } from './lib/api'
import { useNarrow } from './lib/narrow'
import { useOnePane, useStore } from './lib/store'
import { t } from '../../shared/i18n'
import AccountWizard from './views/AccountWizard'
import AskView from './views/AskView'

const SettingsView = lazy(() => import('./views/SettingsView'))
const CalendarView = lazy(() => import('./views/CalendarView'))
const ContactsView = lazy(() => import('./views/ContactsView'))
const SearchView = lazy(() => import('./views/SearchView'))

function openSearch() {
  const st = useStore.getState()
  if (st.view === 'search') document.getElementById('octo-search')?.focus()
  else st.setView('search')
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

function useShortcuts() {
  const gPressed = useRef(0)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useStore.getState()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useStore.setState({ palette: !st.palette })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        st.compose({ mode: 'new' })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !isTyping(e)) {
        e.preventDefault()
        openSearch()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTyping(e)) {
        const last = [...st.toasts].reverse().find((t) => t.undo)
        if (last) {
          e.preventDefault()
          st.dismiss(last.id)
          void st.undo(last.undo!)
        }
        return
      }
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return
      if (st.palette || st.snoozeFor || st.moveFor || st.labelFor || (st.composer && !st.composer.inline)) return
      if (st.view !== 'mail' && !['c', '/', 'g'].includes(e.key) && gPressed.current === 0) return

      const key = e.key
      const list = st.threads
      const idx = list.findIndex((t) => t.thread_id === st.selected)
      const sel = list[idx]
      const go = (d: number) => {
        const next = list[Math.max(0, Math.min(list.length - 1, (idx < 0 ? -1 : idx) + d))]
        if (next) st.select(next.thread_id)
      }
      if (Date.now() - gPressed.current < 1200) {
        gPressed.current = 0
        const map: Record<string, Parameters<typeof st.setMailbox>[0]> = {
          i: { kind: 'smart' }, s: { kind: 'unified', role: 'sent' }, d: { kind: 'local-drafts' }, p: { kind: 'pinned' },
          z: { kind: 'snoozed' }, a: { kind: 'unified', role: 'archive' }, t: { kind: 'unified', role: 'trash' }, n: { kind: 'newsenders' },
        }
        if (map[key]) {
          e.preventDefault()
          st.setMailbox(map[key])
        } else if (key === 'c') st.setView('calendar')
        return
      }
      switch (key) {
        case 'g': gPressed.current = Date.now(); return
        case 'c': e.preventDefault(); st.compose({ mode: 'new' }); return
        case '/': e.preventDefault(); openSearch(); return
        case 'j': case 'ArrowDown': e.preventDefault(); go(1); return
        case 'k': case 'ArrowUp': e.preventDefault(); go(-1); return
        case 'e': case 'd': if (st.targets().length) void st.act('archive'); return
        case '#': case 'Delete': if (st.targets().length) void st.act('trash'); return
        case 's': if (sel) void st.act(sel.pinned ? 'unpin' : 'pin'); return
        case 'h': case 'b': if (st.targets().length) useStore.setState({ snoozeFor: st.targets(), pickerMode: 'snooze' }); return
        case 'v': if (st.targets().length) useStore.setState({ moveFor: st.targets() }); return
        case 'u': if (sel) void st.act(sel.unread ? 'read' : 'unread'); return
        case 'I': if (st.targets().length) void st.act('read'); return
        case 'm': if (sel) void st.act(sel.muted ? 'unmute' : 'mute'); return
        case 'p': if (sel) void st.act(sel.priority ? 'unpriority' : 'priority'); return
        case 'y': if (sel) void st.act(sel.set_aside ? 'unaside' : 'aside'); return
        case 'l': if (st.targets().length && st.accounts.find((a) => a.id === sel?.account_id)?.is_gmail) useStore.setState({ labelFor: st.targets() }); return
        case 'x': if (sel) st.toggleCheck(sel.thread_id); return
        case '!': if (st.targets().length) void st.act('spam'); return
        case 'r': if (sel) st.compose({ mode: 'reply', messageId: sel.latest_message_id, threadId: sel.thread_id }); return
        case 'a': if (sel) st.compose({ mode: 'replyall', messageId: sel.latest_message_id, threadId: sel.thread_id }); return
        case 'f': if (sel) st.compose({ mode: 'forward', messageId: sel.latest_message_id, threadId: sel.thread_id }); return
        case 'Escape': if (st.checked.length) st.clearChecks(); else st.select(null); return
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}

/** One-pane layout: the system/browser back button closes the drawer / goes from a conversation back to the list. */
function usePhoneHistory(narrow: boolean) {
  const selected = useStore((s) => s.selected)
  const drawer = useStore((s) => s.drawer)
  useEffect(() => {
    if (!narrow) return
    const onPop = () => {
      const st = useStore.getState()
      if (st.drawer) useStore.setState({ drawer: false })
      else if (st.selected !== null) st.select(null)
      else if (st.view !== 'mail') st.setView('mail')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [narrow])
  useEffect(() => {
    if (narrow && (selected !== null || drawer) && history.state?.octo !== 'pane') history.pushState({ octo: 'pane' }, '')
  }, [narrow, selected, drawer])
}

export default function App() {
  const { ready, view, accounts, composer, selected, boot, mailbox, drawer } = useStore()
  const narrow = useNarrow()
  const one = useOnePane()
  useShortcuts()
  usePhoneHistory(one)
  // picking a place in the drawer closes it
  useEffect(() => useStore.setState({ drawer: false }), [mailbox, view, composer?.key])

  useEffect(() => {
    void boot()
    const offLink = window.octo.on('deep-link', async (p: { kind: string; id: number }) => {
      const st = useStore.getState()
      if (p.kind === 'draft') st.compose({ mode: 'edit', draftId: p.id, inline: false })
      else if (p.kind === 'thread') (st.setView('mail'), st.select(p.id))
      else if (p.kind === 'message') {
        const m = await api.getMessage(p.id)
        if (m) (st.setView('mail'), st.select(m.thread_id))
      }
    })
    const offCmd = window.octo.on('command', (c: string) => c === 'compose' && useStore.getState().compose({ mode: 'new' }))
    return () => {
      offLink()
      offCmd()
    }
  }, [])

  if (!ready) return <div className="flex h-full items-center justify-center text-muted"><Spinner /></div>
  if (!accounts.length) return (
    <>
      <AccountWizard welcome onDone={() => void useStore.getState().refreshMeta().then(() => useStore.getState().refreshList())} />
      <Toasts />
      <PromptHost />
    </>
  )

  // a reply composer for a conversation that is not on screen shows as a window instead
  const floatingComposer = composer && (!composer.inline || composer.threadId !== selected || view !== 'mail')

  const phoneThread = one && selected !== null

  return (
    <div className="flex h-full">
      {!narrow && <Sidebar />}
      {narrow && drawer && (
        <div className="fixed inset-0 z-40 flex bg-black/40" onMouseDown={() => useStore.setState({ drawer: false })}>
          <div className="anim-drawer box-border h-full max-w-[85vw]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)' }} onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        {view === 'mail' && (
          <>
            <div className="relative flex min-h-0 flex-1 bg-surface">
              {!phoneThread && <ThreadList />}
              {(!one || phoneThread) && <ThreadView />}
              {narrow && !phoneThread && (
                <button
                  title={t('New message')}
                  onClick={() => useStore.getState().compose({ mode: 'new' })}
                  className="absolute bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg"
                  style={{ boxShadow: 'var(--shadow)' }}
                >
                  <PenSquare size={22} />
                </button>
              )}
            </div>
          </>
        )}
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-muted"><Spinner /></div>}>
          {view === 'settings' && <SettingsView />}
          {view === 'calendar' && <CalendarView />}
          {view === 'contacts' && <ContactsView />}
          {view === 'search' && <SearchView />}
        </Suspense>
        {view === 'ask' && <AskView />}
      </main>
      {floatingComposer && <Composer key={composer.key} request={{ ...composer, inline: false }} />}
      <SnoozePicker />
      <MovePicker />
      <CommandPalette />
      <Toasts />
      <PromptHost />
    </div>
  )
}
