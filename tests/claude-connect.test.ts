import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'node:test'
import {
  claudeCodeConfig, claudeDesktopConfig, claudeDesktopDir, cliLink, connectClaude, connectionStatus, disconnectClaude, skillFile,
  type ConnectEnv,
} from '../src/main/claude-connect'

const mk = (over: Partial<ConnectEnv> = {}): ConnectEnv => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'om-claude-'))
  const wrapper = path.join(home, 'OpenMail.app', 'Contents', 'Resources', 'openmail')
  fs.mkdirSync(path.dirname(wrapper), { recursive: true })
  fs.writeFileSync(wrapper, '#!/bin/sh\n')
  return { home, platform: 'darwin', wrapper, launch: { command: wrapper, args: ['mcp'] }, ...over }
}
const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'))

it('links the CLI, registers Claude Code and installs the skill', () => {
  const env = mk()
  const { status, errors } = connectClaude(env)
  assert.deepEqual(errors, [])
  assert.equal(fs.readlinkSync(cliLink(env.home)), env.wrapper)
  assert.deepEqual(json(claudeCodeConfig(env.home)).mcpServers.openmail, { type: 'stdio', command: env.wrapper, args: ['mcp'], env: {} })
  assert.match(fs.readFileSync(skillFile(env.home), 'utf8'), /^---\nname: openmail\ndescription: .*mail/s)
  assert.equal(status.cli, true)
  assert.equal(status.claudeCode, true)
  assert.equal(status.skill, true)
  assert.equal(status.claudeDesktop, 'not-installed')
})

it('keeps the other settings in ~/.claude.json and its permissions', () => {
  const env = mk()
  const f = claudeCodeConfig(env.home)
  fs.writeFileSync(f, JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'x' } } }), { mode: 0o600 })
  connectClaude(env)
  const cfg = json(f)
  assert.equal(cfg.theme, 'dark')
  assert.deepEqual(cfg.mcpServers.other, { command: 'x' })
  assert.ok(cfg.mcpServers.openmail)
  assert.equal(fs.statSync(f).mode & 0o777, 0o600)
})

it('is idempotent and follows an app that moved', () => {
  const env = mk()
  connectClaude(env)
  assert.equal(connectClaude(env).errors.length, 0)
  const moved = { ...env, wrapper: '/Applications/OpenMail.app/Contents/Resources/openmail', launch: { command: '/Applications/OpenMail.app/Contents/Resources/openmail', args: ['mcp'] } }
  assert.equal(connectionStatus(moved).claudeCode, false) // stale path is reported, not hidden
  connectClaude(moved)
  assert.equal(connectionStatus(moved).claudeCode, true)
  assert.equal(fs.readlinkSync(cliLink(env.home)), moved.wrapper)
})

it('does not touch an unreadable config or a real file named openmail', () => {
  const env = mk()
  fs.writeFileSync(claudeCodeConfig(env.home), '{not json')
  fs.mkdirSync(path.dirname(cliLink(env.home)), { recursive: true })
  fs.writeFileSync(cliLink(env.home), 'mine')
  const { errors, status } = connectClaude(env)
  assert.equal(errors.length, 2)
  assert.equal(fs.readFileSync(claudeCodeConfig(env.home), 'utf8'), '{not json')
  assert.equal(fs.readFileSync(cliLink(env.home), 'utf8'), 'mine')
  assert.equal(status.skill, true) // the other steps still ran
})

it('registers Claude Desktop only when it is installed', () => {
  const env = mk()
  fs.mkdirSync(claudeDesktopDir(env.home, 'darwin'), { recursive: true })
  connectClaude(env)
  assert.deepEqual(json(claudeDesktopConfig(env.home, 'darwin')).mcpServers.openmail, { command: env.wrapper, args: ['mcp'] })
  assert.equal(connectionStatus(env).claudeDesktop, true)
})

it('development builds register node + script and skip the CLI link', () => {
  const env = mk({ wrapper: null, launch: { command: 'node', args: ['/repo/out/cli/openmail.js', 'mcp'] } })
  connectClaude(env)
  assert.equal(fs.existsSync(cliLink(env.home)), false)
  assert.equal(connectionStatus(env).cli, null)
  assert.equal(connectionStatus(env).claudeCode, true)
})

it('disconnect removes only what we installed', () => {
  const env = mk()
  fs.writeFileSync(claudeCodeConfig(env.home), JSON.stringify({ mcpServers: { other: { command: 'x' } } }))
  connectClaude(env)
  const s = disconnectClaude(env)
  assert.deepEqual(json(claudeCodeConfig(env.home)).mcpServers, { other: { command: 'x' } })
  assert.equal(fs.existsSync(skillFile(env.home)), false)
  assert.equal(fs.existsSync(cliLink(env.home)), false)
  assert.deepEqual([s.cli, s.claudeCode, s.skill], [false, false, false])
})

it('keeps a hand-edited skill file with a different marker on disconnect', () => {
  const env = mk()
  fs.mkdirSync(path.dirname(skillFile(env.home)), { recursive: true })
  fs.writeFileSync(skillFile(env.home), 'my own openmail skill')
  disconnectClaude(env)
  assert.equal(fs.readFileSync(skillFile(env.home), 'utf8'), 'my own openmail skill')
})
