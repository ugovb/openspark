import { t } from '../../../shared/i18n'
import { type AskTurn, asText, openAskSource } from '../lib/ask'
import { mdToHtml } from '../lib/format'
import { cx, Spinner } from './ui'

/** One question and its streamed answer, with the cited messages as chips. Shared by the Ask view and the panel. */
export function AskTurnView({ turn, compact }: { turn: AskTurn; compact?: boolean }) {
  const sources = Array.isArray(turn.sources) ? turn.sources : []
  const size = compact ? 'text-[13px]' : 'text-[13.5px]'
  return (
    <div className="flex flex-col gap-2">
      <div className={cx('max-w-[85%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2 text-accent-fg', size)}>{asText(turn.q)}</div>
      <div className={cx('rounded-2xl rounded-bl-md border border-line bg-surface', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
        {turn.error ? (
          <div className="text-[13px] text-danger">{asText(turn.error)}</div>
        ) : (
          <div
            className={cx('ai-text selectable break-words leading-relaxed', size)}
            onClick={(e) => {
              const a = (e.target as HTMLElement).closest('a')
              if (!a) return
              // never let a link in the answer navigate the app's own page (web UI) away
              e.preventDefault()
              const id = a.getAttribute('data-msg')
              const href = a.getAttribute('href') || ''
              if (id) void openAskSource(Number(id))
              else if (/^https?:/i.test(href)) void window.openmail.openExternal(href)
            }}
            dangerouslySetInnerHTML={{ __html: mdToHtml(turn.a) }}
          />
        )}
        {turn.busy && <div className="mt-1 flex items-center gap-2 text-[12px] text-muted"><Spinner /> {t('Searching your mail…')}</div>}
        {!turn.busy && sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {sources.map((id) => (
              <button key={id} onClick={() => void openAskSource(id)} className="rounded-md bg-accent-soft px-2 py-0.5 text-[12px] text-accent hover:underline">#{id}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
