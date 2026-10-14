import { ArrowUp, Maximize2, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../../shared/i18n'
import { ASK_EXAMPLES, closeAskPanel, useAsk, useAskStore } from '../lib/ask'
import { useStore } from '../lib/store'
import { AskTurnView } from './AskTranscript'
import ErrorBoundary from './ErrorBoundary'
import { TipButton } from './ui'

/** Side panel with the Ask conversation, opened from the floating pill. Full screen on phones. */
export default function AskPanel() {
  const open = useAskStore((s) => s.panel)
  const view = useStore((s) => s.view)
  if (!open || view === 'ask') return null
  return (
    <aside
      aria-label={t('Ask AI about your mail')}
      className="anim-right flex h-full w-[420px] shrink-0 flex-col border-l border-line bg-surface max-md:fixed max-md:inset-0 max-md:z-40 max-md:box-border max-md:w-full max-md:border-l-0 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]"
    >
      {/* a crash in the answer stays inside the panel */}
      <ErrorBoundary>
        <PanelBody />
      </ErrorBoundary>
    </aside>
  )
}

function PanelBody() {
  const setView = useStore((s) => s.setView)
  const { turns, ask, clear, busy, modelLabel } = useAsk()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Esc closes the panel; captured first so the list does not also drop its selection
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const st = useStore.getState()
      if (st.palette || st.snoozeFor || st.moveFor || (st.composer && !st.composer.inline)) return
      e.preventDefault()
      e.stopPropagation()
      closeAskPanel()
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [])

  const send = (question: string) => {
    if (!question.trim()) return
    setQ('')
    void ask(question)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line pl-4 pr-2">
        <Sparkles size={16} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight">{t('Ask AI')}</div>
          {modelLabel && <div className="truncate text-[11.5px] leading-tight text-muted">{modelLabel}</div>}
        </div>
        {turns.length > 0 && <TipButton label={t('New conversation')} disabled={busy} onClick={clear}><RotateCcw size={15} /></TipButton>}
        <TipButton
          label={t('Open full view')}
          onClick={() => {
            closeAskPanel()
            setView('ask')
          }}
        >
          <Maximize2 size={15} />
        </TipButton>
        <TipButton label={t('Close')} kbd="Esc" onClick={closeAskPanel}><X size={16} /></TipButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-3.5 py-4">
        <div className="flex flex-col gap-4">
          {!turns.length && (
            <div className="px-1 pt-2">
              <div className="text-[15px] font-semibold">{t('What do you want to ask your mail?')}</div>
              <div className="mt-1 text-[12.5px] text-muted">{t('Answers are based on your messages, with sources [#ID].')}</div>
              <div className="mt-4 flex flex-col gap-2">
                {ASK_EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[12.5px] hover:bg-hover">{e}</button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => <AskTurnView key={turn.id} turn={turn} compact />)}
          <div ref={endRef} />
        </div>
      </div>
      <div className="shrink-0 border-t border-line bg-surface p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 focus-within:border-accent">
          <textarea
            ref={inputRef}
            rows={1}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(q)
              }
            }}
            placeholder={t('Ask about your mail…')}
            style={{ outline: 'none' }}
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
          <button aria-label={t('Send')} disabled={!q.trim()} onClick={() => send(q)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40"><ArrowUp size={16} /></button>
        </div>
      </div>
    </div>
  )
}
