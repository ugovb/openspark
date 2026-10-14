import { Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { t } from '../../../shared/i18n'
import { openAskPanel, useAskStore } from '../lib/ask'
import { useNarrow } from '../lib/narrow'
import { useStore } from '../lib/store'

/** Floating "Ask about your mail…" field in the bottom-right corner of the mail list and search. */
export default function AskPill() {
  const view = useStore((s) => s.view)
  const composer = useStore((s) => s.composer)
  const panel = useAskStore((s) => s.panel)
  const narrow = useNarrow()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (panel || composer) return null
  if (view !== 'mail' && view !== 'search') return null
  // phones reach Ask from the tab bar; the pill would sit on the compose button
  if (narrow) return null

  const submit = () => {
    const question = q.trim()
    setQ('')
    inputRef.current?.blur()
    openAskPanel(question)
  }

  return (
    <div
      className="fixed right-5 z-30 max-md:right-4"
      style={{ bottom: narrow ? 'calc(76px + env(safe-area-inset-bottom))' : 'calc(20px + env(safe-area-inset-bottom))' }}
    >
      <label
        className="flex h-10 w-[300px] cursor-text items-center gap-2 rounded-full border border-line bg-surface pl-3.5 pr-4 text-fg transition-[border-color,width] focus-within:w-[340px] focus-within:border-accent max-md:w-[min(300px,calc(100vw-32px))] max-md:focus-within:w-[min(340px,calc(100vw-32px))]"
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <Sparkles size={16} className="shrink-0 text-accent" />
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
          placeholder={t('Ask about your mail…')}
          aria-label={t('Ask about your mail…')}
          style={{ outline: 'none' }}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted"
        />
      </label>
    </div>
  )
}
