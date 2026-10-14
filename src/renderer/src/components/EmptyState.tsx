import type { ReactNode } from 'react'
import { t } from '../../../shared/i18n'
import type { Folder, MailboxRef } from '../../../shared/types'
import { useStore } from '../lib/store'
import { AllDone } from './illustrations'

/** Big "nothing left" screen: landscape circle, title, one line about this place and a way out. */
export function EmptyState({ subtitle, hint, action }: { subtitle: string; hint?: ReactNode; action?: { label: string; run: () => void } }) {
  return (
    <div className="anim-in flex min-h-full flex-col items-center justify-center px-6 py-10 text-center max-md:px-4 max-md:py-8">
      <AllDone />
      <div className="mt-8 text-[30px] font-bold leading-tight tracking-[-0.02em] text-fg max-md:mt-6 max-md:text-[26px]">{t('Nothing left here')}</div>
      <div className="mt-2 max-w-[420px] text-[20px] leading-snug text-muted max-md:text-[17px]">{subtitle}</div>
      {hint && <div className="mt-3 max-w-[380px] text-[13px] leading-relaxed text-faint">{hint}</div>}
      {action && (
        <button
          onClick={action.run}
          className="mt-7 inline-flex h-10 items-center justify-center rounded-full bg-accent px-6 text-[14px] font-semibold text-accent-fg transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function emptyCopy(mailbox: MailboxRef, folders: Folder[]): { subtitle: string; inbox?: boolean; search?: boolean } {
  switch (mailbox.kind) {
    case 'smart': return { subtitle: t('Your inbox is clear.'), inbox: true }
    case 'category': return { subtitle: t('Your inbox is clear.') }
    case 'pinned': return { subtitle: t('No pinned conversations.') }
    case 'snoozed': return { subtitle: t('Nothing is snoozed.') }
    case 'setaside': return { subtitle: t('Nothing set aside.') }
    case 'reminders': return { subtitle: t('No reminders.') }
    case 'scheduled': return { subtitle: t('Nothing scheduled.') }
    case 'local-drafts': return { subtitle: t('No drafts.') }
    case 'search': return { subtitle: t('No results for this search.'), search: true }
    case 'unified':
      if (mailbox.role === 'inbox') return { subtitle: t('Your inbox is clear.'), inbox: true }
      if (mailbox.role === 'drafts') return { subtitle: t('No drafts.') }
      if (mailbox.role === 'trash' || mailbox.role === 'junk') return { subtitle: t('Empty.') }
      return { subtitle: t('This folder is empty.') }
    case 'folder': {
      const role = folders.find((f) => f.id === mailbox.folderId)?.role
      if (role === 'inbox') return { subtitle: t('Your inbox is clear.'), inbox: true }
      if (role === 'trash' || role === 'junk') return { subtitle: t('Empty.') }
      return { subtitle: t('This folder is empty.') }
    }
    default: return { subtitle: t('This folder is empty.') }
  }
}

/** Empty state for the mailbox on screen (list, drafts, scheduled, search results). */
export function MailboxEmpty({ mailbox: forced }: { mailbox?: MailboxRef }) {
  const current = useStore((s) => s.mailbox)
  const folders = useStore((s) => s.folders)
  const mailbox = forced || current
  const copy = emptyCopy(mailbox, folders)
  const action = copy.search
    ? { label: t('Change the search'), run: () => useStore.getState().setView('search') }
    : copy.inbox
      ? undefined
      : { label: t('Go to Inbox'), run: () => useStore.getState().setMailbox({ kind: 'smart' }) }
  const hint = copy.search ? t('Try other words or operators, e.g. from:, newer_than:30d, in:anywhere.') : undefined
  return <EmptyState subtitle={copy.subtitle} hint={hint} action={action} />
}
