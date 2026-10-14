import { Inbox, Menu, Pin, Search, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { cx } from './ui'
import { t } from '../../../shared/i18n'

function Tab({ label, active, onClick, badge, children }: { label: string; active?: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cx('relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors active:scale-95', active ? 'text-accent' : 'text-muted')}
    >
      {children}
      <span className="truncate">{label}</span>
      {!!badge && <span className="tabular absolute left-1/2 top-1 ml-2 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[16px] text-accent-fg">{badge > 99 ? '99+' : badge}</span>}
    </button>
  )
}

/** Phone layout: bottom navigation (Inbox, Pins, Search, Ask, menu). */
export default function TabBar() {
  const { mailbox, accountFilter, view, counts, setMailbox, setView } = useStore()
  const mail = view === 'mail'
  return (
    <nav aria-label={t('Navigation')} className="flex h-14 shrink-0 items-stretch border-t border-line bg-surface">
      <Tab label={t('Inbox')} active={mail && mailbox.kind === 'smart' && accountFilter === null} badge={counts?.inboxUnread} onClick={() => setMailbox({ kind: 'smart' })}><Inbox size={21} /></Tab>
      <Tab label={t('Pins')} active={mail && mailbox.kind === 'pinned'} onClick={() => setMailbox({ kind: 'pinned' })}><Pin size={21} /></Tab>
      <Tab label={t('Search')} active={view === 'search' || (mail && mailbox.kind === 'search')} onClick={() => setView('search')}><Search size={21} /></Tab>
      <Tab label={t('Ask AI')} active={view === 'ask'} onClick={() => setView('ask')}><Sparkles size={21} /></Tab>
      <Tab label={t('More')} onClick={() => useStore.setState({ drawer: true })}><Menu size={21} /></Tab>
    </nav>
  )
}
