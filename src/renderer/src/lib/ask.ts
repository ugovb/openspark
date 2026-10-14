// "Ask AI about your mail": one conversation shared by the full Ask view and the floating panel.
import { create } from 'zustand'
import type { AppSettings } from '../../../shared/types'
import { t } from '../../../shared/i18n'
import { api, errorText, stream } from './api'
import { isNarrow } from './narrow'
import { useStore } from './store'

export interface AskTurn {
  id: number
  q: string
  /** answer so far (markdown); always a string */
  a: string
  sources: number[]
  busy: boolean
  error?: string
  provider?: string
  model?: string
}

interface AskState {
  turns: AskTurn[]
  /** the floating panel is open */
  panel: boolean
}

export const useAskStore = create<AskState>(() => ({ turns: [], panel: false }))

let seq = 0

export const ASK_EXAMPLES = [
  t('Which invoices did I get this month, and for how much?'),
  t("What did I promise to reply to but haven't yet?"),
  t('When is the deadline for the project Sebastian wrote about?'),
  t('Summarize the most important messages from developers in the last week'),
]

/** Streamed chunks and results come over IPC or HTTP from code we do not control (AI providers, an older
 *  home server): treat every field as untrusted and never let a non-string reach React or the markdown renderer. */
export function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

export function asSources(v: unknown, text = ''): number[] {
  const raw = Array.isArray(v) ? v : [...text.matchAll(/\[#(\d+)\]/g)].map((m) => m[1])
  const out: number[] = []
  for (const x of raw) {
    const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : NaN
    if (Number.isSafeInteger(n) && n > 0 && !out.includes(n)) out.push(n)
  }
  return out
}

function patch(id: number, p: Partial<AskTurn>) {
  useAskStore.setState((s) => ({ turns: s.turns.map((x) => (x.id === id ? { ...x, ...p } : x)) }))
}

export async function askQuestion(question: string): Promise<void> {
  const q = asText(question).trim()
  if (!q) return
  const id = ++seq
  useAskStore.setState((s) => ({ turns: [...s.turns, { id, q, a: '', sources: [], busy: true }] }))
  let acc = ''
  try {
    const r = await stream<unknown>('aiAsk', [q], (d) => {
      const piece = asText(d)
      if (!piece) return
      acc += piece
      patch(id, { a: acc })
    })
    const res = r && typeof r === 'object' ? (r as Record<string, unknown>) : {}
    const a = asText(res.text) || acc
    patch(id, {
      a,
      sources: asSources(res.sources, a),
      provider: asText(res.provider) || undefined,
      model: asText(res.model) || undefined,
      busy: false,
    })
  } catch (e) {
    patch(id, { busy: false, error: errorText(e) || t('Something went wrong') })
  }
}

/** Opens the conversation that contains message #id (a cited source). */
export async function openAskSource(id: number): Promise<void> {
  const st = useStore.getState()
  try {
    const m = await api.getMessage(id)
    if (!m) return
    st.setMailbox({ kind: 'search', query: `thread:${m.thread_id}` })
    st.select(m.thread_id)
    // on a phone the panel covers the whole screen: get it out of the way
    if (isNarrow()) useAskStore.setState({ panel: false })
  } catch (e) {
    st.toast({ level: 'error', message: errorText(e) })
  }
}

/** Name of the model that answers, as shown in the Ask header. */
export function askModelLabel(settings: AppSettings | null): string {
  const ai = settings?.ai
  if (!ai) return ''
  switch (ai.provider) {
    case 'claude': return `Claude (${asText(ai.claudeModel)})`
    case 'openai': return asText(ai.openaiModel) || 'API'
    case 'anthropic-compat': return asText(ai.anthropicCompatModel) || 'API'
    case 'ollama': return t('Ollama ({model}) — local', { model: asText(ai.ollamaModel) })
    default: return t('AI off')
  }
}

export function openAskPanel(question?: string): void {
  useAskStore.setState({ panel: true })
  if (question?.trim()) void askQuestion(question)
}

export function closeAskPanel(): void {
  useAskStore.setState({ panel: false })
}

export function useAsk() {
  const turns = useAskStore((s) => s.turns)
  const settings = useStore((s) => s.settings)
  return {
    turns,
    busy: turns.some((x) => x.busy),
    modelLabel: askModelLabel(settings),
    ask: askQuestion,
    openSource: openAskSource,
    clear: () => useAskStore.setState((s) => ({ turns: s.turns.filter((x) => x.busy) })),
  }
}
