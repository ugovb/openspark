// Helpers for mail rules that the renderer can import too (no src/core imports here).
import type { RuleAction, RuleGroup, RuleNode, RuleSchedule } from './types'

export function isGroup(n: RuleNode): n is RuleGroup {
  return 'group' in n
}

/** Actions a scheduled rule may use: safe to repeat, and trash keeps mail recoverable in Trash until the server purge window. */
export const SCHEDULE_SAFE_ACTIONS: RuleAction['type'][] = ['archive', 'mark_read', 'move', 'label', 'categorize', 'set_aside', 'trash']

export function isValidSchedule(s: unknown): s is RuleSchedule {
  const x = s as Partial<RuleSchedule> | null
  return !!x && typeof x === 'object' && typeof x.at === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.at) &&
    Array.isArray(x.days) && x.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
}

/** Latest scheduled local time at or before nowMs, searching back 8 days. Returns 0 if none or if the schedule is malformed. */
export function lastOccurrence(s: RuleSchedule, nowMs: number): number {
  if (!isValidSchedule(s)) return 0
  const [h, m] = s.at.split(':').map(Number)
  const today = new Date(nowMs)
  for (let back = 0; back <= 8; back++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back, h, m, 0, 0)
    if (d.getTime() > nowMs) continue
    if (s.days.length && !s.days.includes(d.getDay())) continue
    return d.getTime()
  }
  return 0
}
