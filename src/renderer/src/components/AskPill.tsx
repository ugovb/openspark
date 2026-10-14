import { Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { t } from '../../../shared/i18n'
import { openAskPanel, useAskStore } from '../lib/ask'
import { useNarrow } from '../lib/narrow'
import { useStore } from '../lib/store'
import { cx } from './ui'

/** Floating "Ask about your mail…" field in the bottom-right corner of the mail list and search. */
export default function AskPill() {
  const view = useStore((s) => s.view)
  const composer = useStore((s) => s.composer)
  const selected = useStore((s) => s.selected)
  const panel = useAskStore((s) => s.panel)
  const narrow = useNarrow()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (panel || composer) return null
  if (view !== 'mail' && view !== 'search') return null
  // phones: only over the list, next to the round compose button
  if (narrow && (view !== 'mail' || selected !== null)) return null

  const submit = () => {
    const question = q.trim()
    setQ('')
    inputRef.current?.blur()
    openAskPanel(question)
  }

  return (
    <div
      className={cx('fixed z-30', narrow ? 'left-4 right-[88px]' : 'right-5')}
      style={{ bottom: 'calc(' + (narrow ? 16 : 20) + 'px + env(safe-area-inset-bottom))' }}
    >
      <label
        className={cx(
          'flex cursor-text items-center gap-2 rounded-full border border-line bg-surface text-fg transition-[border-color,width] focus-within:border-accent',
          narrow ? 'h-14 w-full pl-5 pr-5 text-[17px]' : 'h-10 w-[300px] pl-3.5 pr-4 focus-within:w-[340px]',
        )}
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <Sparkles size={narrow ? 22 : 16} className="shrink-0 text-accent" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setQ('')
              inputRef.current?.blur()
            }
          }}
          placeholder={narrow ? `${t('Ask AI')}…` : t('Ask about your mail…')}
          aria-label={t('Ask about your mail…')}
          style={{ outline: 'none' }}
          className={cx('min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted', narrow ? 'text-[17px]' : 'text-[13.5px]')}
        />
      </label>
    </div>
  )
}
