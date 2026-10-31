// Pure tree and schedule helpers for the rules editor (renderer-safe, no src/core imports).
import { isGroup, SCHEDULE_SAFE_ACTIONS } from './rules'
import type { RuleAction, RuleNode, RuleSchedule } from './types'

/** Index path from the root list to a node: [1, 0] = first item of the second root node. */
export type NodePath = number[]

const MAX_DEPTH = 3

function editList(list: RuleNode[], path: NodePath, fn: (list: RuleNode[], i: number) => RuleNode[]): RuleNode[] {
  const [head, ...rest] = path
  if (!rest.length) return fn(list, head)
  return list.map((n, i) => (i === head && isGroup(n) ? { ...n, items: editList(n.items, rest, fn) } : n))
}

export function updateAt(nodes: RuleNode[], path: NodePath, fn: (n: RuleNode) => RuleNode): RuleNode[] {
  return editList(nodes, path, (list, i) => list.map((n, j) => (j === i ? fn(n) : n)))
}

/** Removes a node; a group left without children goes too, up the tree (the root list may end up empty). */
export function removeAt(nodes: RuleNode[], path: NodePath): RuleNode[] {
  const [head, ...rest] = path
  if (!rest.length) return nodes.filter((_, i) => i !== head)
  return nodes.flatMap((n, i) => {
    if (i !== head || !isGroup(n)) return [n]
    const items = removeAt(n.items, rest)
    return items.length ? [{ ...n, items }] : []
  })
}

/** Appends a node to the root list (groupPath []) or to the group at groupPath. */
export function insertAt(nodes: RuleNode[], groupPath: NodePath, node: RuleNode): RuleNode[] {
  if (!groupPath.length) return [...nodes, node]
  return updateAt(nodes, groupPath, (g) => (isGroup(g) ? { ...g, items: [...g.items, node] } : g))
}

export function countLeaves(nodes: RuleNode[]): number {
  return nodes.reduce((n, x) => n + (isGroup(x) ? countLeaves(x.items) : 1), 0)
}

/** Whether a new group may be added inside the list at groupPath ([] = root) without passing the nesting limit. */
export function canAddGroup(groupPath: NodePath): boolean {
  return groupPath.length < MAX_DEPTH
}

/** Keeps only the actions a scheduled rule may run and lists the types that were dropped. */
export function dropUnsafeActions(actions: RuleAction[]): { actions: RuleAction[]; removed: RuleAction['type'][] } {
  const safe = actions.filter((a) => SCHEDULE_SAFE_ACTIONS.includes(a.type))
  return { actions: safe, removed: actions.filter((a) => !SCHEDULE_SAFE_ACTIONS.includes(a.type)).map((a) => a.type) }
}

/** Like dropUnsafeActions, but a rule left with no action gets a safe default ("archive"), so it can still be saved. */
export function actionsForSchedule(actions: RuleAction[]): { actions: RuleAction[]; removed: RuleAction['type'][]; addedDefault: boolean } {
  const r = dropUnsafeActions(actions)
  return r.actions.length ? { ...r, addedDefault: false } : { actions: [{ type: 'archive' }], removed: r.removed, addedDefault: true }
}

export type RuleProblem = 'name' | 'no_conditions' | 'no_actions' | 'empty_group' | 'age_value' | 'time'

const validAge = (v: string): boolean => /^\d+$/.test((v || '').trim())

function conditionProblem(nodes: RuleNode[]): RuleProblem | null {
  for (const n of nodes) {
    if (isGroup(n)) {
      if (!n.items.length) return 'empty_group'
      const p = conditionProblem(n.items)
      if (p) return p
    } else if (n.field === 'age_days' && !validAge(n.value)) return 'age_value'
  }
  return null
}

/** First reason a rule would be refused (mirrors validateRule in src/core/rules.ts, plus a name and non-empty lists). */
export function ruleProblem(r: { name: string; conditions: RuleNode[]; actions: RuleAction[]; schedule?: RuleSchedule | null }): RuleProblem | null {
  if (!r.name.trim()) return 'name'
  if (!r.conditions.length) return 'no_conditions'
  if (!r.actions.length) return 'no_actions'
  const c = conditionProblem(r.conditions)
  if (c) return c
  if (r.schedule && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.schedule.at || '')) return 'time'
  return null
}
