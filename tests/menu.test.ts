import assert from 'node:assert/strict'
import { it } from 'node:test'
import { APP_COMMANDS, type AppCommand, isAppCommand, menuHandlesKey } from '../src/shared/commands'
import { appMenuTemplate } from '../src/main/menu'

const sent: AppCommand[] = []
const tpl = appMenuTemplate('OpenMail', (c) => sent.push(c))
const items = (xs: any[]): any[] => xs.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? items(i.submenu) : [])])
const custom = items(tpl).filter((i) => typeof i.click === 'function')

it('opens Settings with CmdOrCtrl+, from the app menu', () => {
  const s = (tpl[0] as any).submenu.find((i: any) => i.accelerator === 'CmdOrCtrl+,')
  s.click(); assert.equal(sent.at(-1), 'settings')
})
it('reaches every command exactly once', () => {
  sent.length = 0; for (const i of custom) i.click()
  assert.deepEqual([...sent].sort(), [...APP_COMMANDS].sort())
})
it('only the four CmdOrCtrl shortcuts are real accelerators', () => {
  assert.deepEqual(custom.map((i) => i.accelerator).filter(Boolean).sort(), ['CmdOrCtrl+,', 'CmdOrCtrl+F', 'CmdOrCtrl+K', 'CmdOrCtrl+N'])
  for (const i of custom) assert.equal(i.registerAccelerator, undefined, i.label)
})
it('menuHandlesKey skips only meta combos on darwin', () => {
  const k = (key: string, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...o })
  assert.equal(menuHandlesKey('darwin', k('n', { metaKey: true })), true)
  assert.equal(menuHandlesKey('darwin', k('n', { metaKey: true, shiftKey: true })), false)
  assert.equal(menuHandlesKey('darwin', k('r', { metaKey: true })), false)
  assert.equal(menuHandlesKey('linux', k('n', { ctrlKey: true })), false)
  assert.equal(menuHandlesKey('darwin', k('n', { metaKey: true, altKey: true })), false)
})
it('validates command names', () => {
  assert.equal(isAppCommand('reply'), true); assert.equal(isAppCommand('rm -rf'), false)
})
