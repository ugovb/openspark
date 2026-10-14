import { ArrowLeft, AtSign, CalendarClock, ChevronsUpDown, FileText, Folder, Lightbulb, Mail, Paperclip, Pin, Search, Type, User, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cx, Tip } from '../components/ui'
import { useNarrow } from '../lib/narrow'
import { setUi, useStore } from '../lib/store'
import { t } from '../../../shared/i18n'

interface Hint {
  op: string
  hint: string
  icon: ReactNode
}

const TIPS: Hint[] = [
  { op: 'from:anna', hint: t('Mail from Anna'), icon: <User size={14} /> },
  { op: 'to:marc', hint: t('Mail sent to Marc'), icon: <User size={14} /> },
  { op: 'cc:paul', hint: t('Paul in copy'), icon: <AtSign size={14} /> },
  { op: 'subject:invoice', hint: t('Subject contains “invoice”'), icon: <Type size={14} /> },
  { op: '"exact words"', hint: t('This exact phrase'), icon: <Type size={14} /> },
  { op: 'has:attachment', hint: t('With attachments'), icon: <Paperclip size={14} /> },
  { op: 'has:pdf', hint: t('With a PDF'), icon: <FileText size={14} /> },
  { op: 'in:inbox', hint: t('In the inbox'), icon: <Folder size={14} /> },
  { op: 'in:sent', hint: t('In Sent'), icon: <Folder size={14} /> },
  { op: 'in:anywhere', hint: t('Everywhere, Trash and Spam included'), icon: <Folder size={14} /> },
  { op: 'is:unread', hint: t('Unread conversations'), icon: <Mail size={14} /> },
  { op: 'is:pinned', hint: t('Pinned conversations'), icon: <Pin size={14} /> },
  { op: 'newer_than:7d', hint: t('From the last 7 days'), icon: <CalendarClock size={14} /> },
  { op: 'since:2026-01-01', hint: t('Since a date'), icon: <CalendarClock size={14} /> },
  { op: 'older_than:1y', hint: t('Older than a year'), icon: <CalendarClock size={14} /> },
  { op: 'larger:5M', hint: t('Bigger than 5 MB'), icon: <Paperclip size={14} /> },
]

export default function SearchView() {
  const { accounts, settings, searchQuery, accountFilter, setMailbox, setView, mailbox } = useStore()
  const narrow = useNarrow()
  const [q, setQ] = useState(searchQuery)
  const [account, setAccount] = useState<number | null>(mailbox.kind === 'search' ? accountFilter : null)
  const input = useRef<HTMLInputElement>(null)
  const recent = settings?.ui?.recentSearches || []

  useEffect(() => input.current?.focus(), [])

  const run = (query: string) => {
    const v = query.trim()
    if (!v) return
    setUi({ recentSearches: [v, ...recent.filter((r) => r !== v)].slice(0, 12) })
    setMailbox({ kind: 'search', query: v }, account)
  }
  const add = (op: string) => {
    const next = q.trim() ? `${q.trim()} ${op}` : op
    setQ(next.endsWith(':') ? next : next + ' ')
    input.current?.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface">
      <div className="mx-auto w-full max-w-[1100px] px-6 pb-24 pt-4 max-md:px-3">
        <div className="flex items-center gap-3">
          <Tip label={t('Back')} kbd="Esc">
            <button aria-label={t('Back')} onClick={() => setView('mail')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:bg-hover hover:text-fg">
              <ArrowLeft size={15} />
            </button>
          </Tip>
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <Search size={16} className="shrink-0 text-faint" />
            <input
              id="octo-search"
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run(q)
                if (e.key === 'Escape') (e.stopPropagation(), setView('mail'))
              }}
              placeholder={t('Search mail…')}
              className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-faint focus-visible:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {q && (
              <button aria-label={t('Clear')} onClick={() => (setQ(''), input.current?.focus())} className="text-faint hover:text-fg">
                <X size={15} />
              </button>
            )}
            {accounts.length > 1 && (
              <label className="relative flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-fg max-md:hidden">
                <select
                  aria-label={t('Account')}
                  value={account ?? ''}
                  onChange={(e) => setAccount(e.target.value ? Number(e.target.value) : null)}
                  className="appearance-none bg-transparent pr-4 outline-none"
                >
                  <option value="">{t('All accounts')}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                </select>
                <ChevronsUpDown size={12} className="pointer-events-none absolute right-0 text-muted" />
              </label>
            )}
          </div>
        </div>

        {recent.length > 0 && (
          <section className="mt-6 pl-11 max-md:pl-0">
            <h2 className="mb-2 text-[12.5px] text-muted">{t('Recent searches')}</h2>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <span key={r} className="group flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 pl-2.5 pr-1 text-[13px] transition-colors hover:bg-hover">
                  <button onClick={() => run(r)} className="flex items-center gap-1.5">
                    <Search size={13} className="text-accent" />
                    <span className="max-w-[260px] truncate">{r}</span>
                  </button>
                  <button aria-label={t('Remove')} onClick={() => setUi({ recentSearches: recent.filter((x) => x !== r) })} className="flex h-6 w-6 items-center justify-center rounded-md text-faint opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7 pl-11 max-md:pl-0">
          <h2 className="mb-3 text-[12.5px] text-muted">{t('Tips')}</h2>
          <div className={cx('grid gap-x-6 gap-y-3', narrow ? 'grid-cols-2' : 'grid-cols-4')}>
            {TIPS.map((tip) => (
              <button key={tip.op} onClick={() => add(tip.op)} className="group flex items-start gap-2 rounded-lg p-1 text-left hover:bg-hover">
                <span className="mt-0.5 text-accent">{tip.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] text-fg">{tip.op}</span>
                  <span className="block truncate text-[12px] text-muted">{tip.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
            <Lightbulb size={14} className="text-warning" />
            {t('Combine operators for sharper results, e.g. from:anna has:attachment newer_than:30d')}
          </p>
        </section>
      </div>
    </div>
  )
}
