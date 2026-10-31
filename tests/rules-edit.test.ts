// Pure helpers behind the rules editor: tree edits and schedule-safe actions.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { actionsForSchedule, canAddGroup, countLeaves, dropUnsafeActions, insertAt, removeAt, ruleProblem, updateAt } from '../src/shared/rules-edit'
import type { RuleCondition, RuleNode } from '../src/shared/types'

const c = (value: string): RuleCondition => ({ field: 'subject', op: 'contains', value })
const tree = (): RuleNode[] => [c('a'), { group: 'any', items: [c('b'), { group: 'none', items: [c('c')] }] }]

describe('rules editor helpers', () => {
  it('updates a nested node without mutating the original', () => {
    const t = tree()
    const next = updateAt(t, [1, 1, 0], () => c('z'))
    assert.deepEqual(((next[1] as any).items[1] as any).items[0], c('z'))
    assert.deepEqual(((t[1] as any).items[1] as any).items[0], c('c'))
  })
  it('removes a node by path', () => {
    const next = removeAt(tree(), [1, 0])
    assert.equal((next[1] as any).items.length, 1)
    assert.equal(removeAt(tree(), [0]).length, 1)
  })
  it('inserts into the root or a group', () => {
    assert.equal(insertAt(tree(), [], c('n')).length, 3)
    assert.equal((insertAt(tree(), [1], c('n'))[1] as any).items.length, 3)
  })
  it('counts leaves', () => assert.equal(countLeaves(tree()), 3))
  it('allows groups up to three levels', () => {
    assert.equal(canAddGroup([]), true)
    assert.equal(canAddGroup([1]), true)
    assert.equal(canAddGroup([1, 1]), true)
    assert.equal(canAddGroup([1, 1, 0]), false)
  })
  it('drops actions a scheduled rule may not use', () => {
    const r = dropUnsafeActions([{ type: 'archive' }, { type: 'block' }, { type: 'pin' }, { type: 'label', value: 'x' }, { type: 'snooze', value: '2' }])
    assert.deepEqual(r.actions, [{ type: 'archive' }, { type: 'label', value: 'x' }])
    assert.deepEqual(r.removed, ['block', 'pin', 'snooze'])
  })
  it('removing the last child of a group removes the group, up the tree', () => {
    const t: RuleNode[] = [c('a'), { group: 'any', items: [{ group: 'none', items: [c('b')] }] }]
    assert.deepEqual(removeAt(t, [1, 0, 0]), [c('a')])
    assert.equal(removeAt(tree(), [1, 1, 0]).length, 2)
    assert.equal((removeAt(tree(), [1, 1, 0])[1] as any).items.length, 1)
  })
  it('gives a scheduled rule a safe default action when none is left', () => {
    assert.deepEqual(actionsForSchedule([{ type: 'block' }]), { actions: [{ type: 'archive' }], removed: ['block'], addedDefault: true })
    assert.equal(actionsForSchedule([{ type: 'block' }, { type: 'trash' }]).addedDefault, false)
    assert.deepEqual(actionsForSchedule([{ type: 'trash' }]).actions, [{ type: 'trash' }])
  })
  it('reports why a rule cannot be saved', () => {
    const ok = { name: 'x', conditions: [c('a')], actions: [{ type: 'archive' as const }], schedule: null }
    assert.equal(ruleProblem(ok), null)
    assert.equal(ruleProblem({ ...ok, name: '  ' }), 'name')
    assert.equal(ruleProblem({ ...ok, conditions: [] }), 'no_conditions')
    assert.equal(ruleProblem({ ...ok, actions: [] }), 'no_actions')
    assert.equal(ruleProblem({ ...ok, conditions: [{ group: 'all', items: [] }] }), 'empty_group')
    assert.equal(ruleProblem({ ...ok, conditions: [{ group: 'all', items: [{ field: 'age_days', op: 'greater_than', value: '1.5' }] }] }), 'age_value')
    assert.equal(ruleProblem({ ...ok, conditions: [{ field: 'age_days', op: 'less_than', value: '' }] }), 'age_value')
    assert.equal(ruleProblem({ ...ok, conditions: [{ field: 'age_days', op: 'less_than', value: '30' }] }), null)
    assert.equal(ruleProblem({ ...ok, schedule: { at: '25:00', days: [] } }), 'time')
    assert.equal(ruleProblem({ ...ok, schedule: { at: '08:30', days: [] } }), null)
  })
})
