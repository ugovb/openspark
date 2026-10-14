import { ArrowUp, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../../shared/i18n'
import { ASK_EXAMPLES, useAsk } from '../lib/ask'
import { useStore } from '../lib/store'
import { AskTurnView } from '../components/AskTranscript'
import DrawerButton from '../components/DrawerButton'
import { TipButton } from '../components/ui'
import { AskAI } from '../components/illustrations'

export default function AskView() {
  const setView = useStore((s) => s.setView)
  const { turns, ask, clear, busy, modelLabel } = useAsk()
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  const send = (question: string) => {
    if (!question.trim()) return
    setQ('')
    void ask(question)
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <div className="flex h-12 items-center gap-2 border-b border-line bg-surface px-4 max-md:px-2">
        <DrawerButton />
        <Sparkles size={16} className="text-accent" />
        <div className="flex-1 font-semibold">{t('Ask AI about your mail')}</div>
        <span className="text-[12px] text-muted max-md:hidden">{modelLabel}</span>
        {turns.length > 0 && <TipButton label={t('New conversation')} disabled={busy} onClick={clear}><RotateCcw size={15} /></TipButton>}
        <TipButton label={t('Close')} onClick={() => setView('mail')}><X size={16} /></TipButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 max-md:px-3 max-md:py-4">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
          {!turns.length && (
            <div className="mt-[6vh] text-center">
              <div className="mb-3 flex justify-center"><AskAI /></div>
              <div className="text-[18px] font-semibold">{t('What do you want to ask your mail?')}</div>
              <div className="mt-1 text-[13px] text-muted">{t('Answers are based on your messages, with sources [#ID].')}</div>
              <div className="mx-auto mt-5 grid max-w-[640px] grid-cols-2 max-md:grid-cols-1 gap-2">
                {ASK_EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} className="rounded-xl border border-line bg-surface p-3 text-left text-[13px] hover:bg-hover">{e}</button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => <AskTurnView key={turn.id} turn={turn} />)}
          <div ref={endRef} />
        </div>
      </div>
      <div className="border-t border-line bg-surface px-6 py-3 max-md:px-3">
        <div className="mx-auto flex max-w-[760px] items-end gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 focus-within:border-accent">
          <textarea
            autoFocus
            rows={1}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(q)
              }
            }}
            placeholder={t('E.g. how much did I pay for hosting this year?')}
            style={{ outline: 'none' }}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] outline-none"
          />
          <button aria-label={t('Send')} disabled={!q.trim()} onClick={() => send(q)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40"><ArrowUp size={16} /></button>
        </div>
      </div>
    </div>
  )
}
