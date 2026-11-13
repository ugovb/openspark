// One-click "Connect to Claude": makes Claude Code and Claude Desktop use OpenMail whenever mail comes up.
// It does three things, all in the user's home folder and all idempotent:
//   1. puts an `openmail` command on the PATH (~/.local/bin/openmail → the wrapper inside the app),
//   2. registers the MCP server in Claude Code (~/.claude.json) and Claude Desktop (claude_desktop_config.json),
//   3. installs a Claude Code skill (~/.claude/skills/openmail/SKILL.md) that tells Claude to use it for any mail request.
// No Electron import: everything takes explicit paths so it can be tested against a temporary home.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface McpLaunch {
  command: string
  args: string[]
}

export interface ConnectEnv {
  home: string
  platform: NodeJS.Platform
  /** how the MCP server is started: the app's wrapper script, or `node out/cli/openmail.js` in development */
  launch: McpLaunch
  /** the wrapper to link as `openmail` on the PATH (packaged app only) */
  wrapper: string | null
}

export interface ConnectStatus {
  /** `~/.local/bin/openmail` points at this app (null in development builds) */
  cli: boolean | null
  claudeCode: boolean
  claudeDesktop: boolean | 'not-installed'
  skill: boolean
  /** ~/.local/bin is on the PATH of a login shell, as far as we can tell from this process */
  onPath: boolean
}

export const SERVER_NAME = 'openmail'
const SKILL_MARKER = 'openmail-skill-version: 1'

export const claudeCodeConfig = (home: string): string => path.join(home, '.claude.json')
export const skillFile = (home: string): string => path.join(home, '.claude', 'skills', 'openmail', 'SKILL.md')
export const cliLink = (home: string): string => path.join(home, '.local', 'bin', 'openmail')

export function claudeDesktopDir(home: string, platform: NodeJS.Platform): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude')
  if (platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude')
  return path.join(home, '.config', 'Claude')
}

export const claudeDesktopConfig = (home: string, platform: NodeJS.Platform): string =>
  path.join(claudeDesktopDir(home, platform), 'claude_desktop_config.json')

export const SKILL_TEXT = `---
name: openmail
description: Read, search, triage, reply to and draft the user's email, and manage their calendar, through OpenMail. Use this whenever the user talks about their mail, inbox, messages, emails, a sender, an unanswered message, a reply, a draft, an invitation or their agenda, even if they do not say "OpenMail".
---
<!-- ${SKILL_MARKER} (installed by the OpenMail app; reinstalled by Settings → AI agents & CLI) -->

# OpenMail

The user's mail lives in OpenMail. For anything about their mail or calendar, use OpenMail instead of guessing or asking them to paste messages.

Use the \`openmail\` MCP tools when they are available (\`list_emails\`, \`search\`, \`read_thread\`, \`save_draft\`, \`email_action\`, \`calendar_events\`…). Otherwise run the CLI in a terminal: \`openmail help\` lists every command, and \`--json\` gives machine-readable output.

## How to work

- **Reading**: \`openmail emails\` is the Smart Inbox, \`openmail search --filter "from:anna newer_than:7d"\` searches everything, \`openmail thread tID\` reads a whole conversation with attachments. Read the thread before summarising or answering it.
- **Replying and writing**: always create a **draft** (\`openmail draft --reply-to ID --body "…"\`, MCP \`save_draft\`), show the user what you wrote, and let them decide. Match the language and tone of the thread.
- **Sending**: never send (\`openmail send\`, MCP \`send_draft\`) unless the user clearly asked for that exact message to go out. Send later with \`--at "tomorrow 9:00"\` when they prefer.
- **Organising**: archive, snooze, remind, label with \`openmail action …\`. Say what you changed. Deletions and spam marking need the user's go-ahead.
- **Access levels**: each account starts read-only. If a call is refused, tell the user which level is needed (Settings → AI agents & CLI in the app); you cannot raise it yourself.
- Times printed by the CLI are local with their UTC offset; keep that offset when you repeat them.
`

function readJson(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return {}
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'))
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Atomic write that keeps the file's permissions (~/.claude.json holds tokens and is 0600). */
function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o600
  const tmp = `${file}.openmail-${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode })
  fs.renameSync(tmp, file)
}

const sameLaunch = (entry: unknown, l: McpLaunch): boolean => {
  const e = entry as { command?: unknown; args?: unknown } | undefined
  return !!e && e.command === l.command && JSON.stringify(e.args) === JSON.stringify(l.args)
}

function registerMcp(file: string, launch: McpLaunch, claudeCode: boolean): void {
  const cfg = readJson(file)
  if (!cfg) throw new Error(`${file} is not valid JSON: left untouched`)
  const servers = (cfg.mcpServers && typeof cfg.mcpServers === 'object' ? cfg.mcpServers : {}) as Record<string, unknown>
  servers[SERVER_NAME] = claudeCode
    ? { type: 'stdio', command: launch.command, args: launch.args, env: {} }
    : { command: launch.command, args: launch.args }
  cfg.mcpServers = servers
  writeJson(file, cfg)
}

function linkCli(env: ConnectEnv): void {
  if (!env.wrapper) return
  const link = cliLink(env.home)
  fs.mkdirSync(path.dirname(link), { recursive: true })
  try {
    const st = fs.lstatSync(link)
    // only replace our own symlink: a real file with that name belongs to the user
    if (!st.isSymbolicLink()) throw new Error(`${link} already exists and is not a link: left untouched`)
    fs.unlinkSync(link)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
  fs.symlinkSync(env.wrapper, link)
}

/** Install everything. Each step is independent: one failing does not stop the others; errors are returned. */
export function connectClaude(env: ConnectEnv): { status: ConnectStatus; errors: string[] } {
  const errors: string[] = []
  const step = (fn: () => void): void => {
    try {
      fn()
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  step(() => linkCli(env))
  step(() => registerMcp(claudeCodeConfig(env.home), env.launch, true))
  // Claude Desktop only if it is installed (its folder exists): never create config for an app that is not there
  step(() => {
    if (fs.existsSync(claudeDesktopDir(env.home, env.platform))) registerMcp(claudeDesktopConfig(env.home, env.platform), env.launch, false)
  })
  step(() => {
    const f = skillFile(env.home)
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, SKILL_TEXT)
  })
  return { status: connectionStatus(env), errors }
}

/** Remove what connectClaude installed (only entries that are ours). */
export function disconnectClaude(env: ConnectEnv): ConnectStatus {
  const drop = (file: string): void => {
    const cfg = readJson(file)
    const servers = cfg?.mcpServers as Record<string, unknown> | undefined
    if (cfg && servers && SERVER_NAME in servers) {
      delete servers[SERVER_NAME]
      writeJson(file, cfg)
    }
  }
  drop(claudeCodeConfig(env.home))
  drop(claudeDesktopConfig(env.home, env.platform))
  try {
    if (fs.readFileSync(skillFile(env.home), 'utf8').includes(SKILL_MARKER)) fs.rmSync(path.dirname(skillFile(env.home)), { recursive: true, force: true })
  } catch {
    /* no skill */
  }
  try {
    const link = cliLink(env.home)
    if (env.wrapper && fs.lstatSync(link).isSymbolicLink() && fs.readlinkSync(link) === env.wrapper) fs.unlinkSync(link)
  } catch {
    /* no link */
  }
  return connectionStatus(env)
}

export function connectionStatus(env: ConnectEnv): ConnectStatus {
  const registered = (file: string): boolean => sameLaunch((readJson(file)?.mcpServers as Record<string, unknown> | undefined)?.[SERVER_NAME], env.launch)
  let cli: boolean | null = null
  if (env.wrapper) {
    try {
      cli = fs.readlinkSync(cliLink(env.home)) === env.wrapper
    } catch {
      cli = false
    }
  }
  let skill = false
  try {
    skill = fs.readFileSync(skillFile(env.home), 'utf8').includes(SKILL_MARKER)
  } catch {
    /* not installed */
  }
  const bin = path.dirname(cliLink(env.home))
  return {
    cli,
    claudeCode: registered(claudeCodeConfig(env.home)),
    claudeDesktop: fs.existsSync(claudeDesktopDir(env.home, env.platform)) ? registered(claudeDesktopConfig(env.home, env.platform)) : 'not-installed',
    skill,
    onPath: (process.env.PATH || '').split(path.delimiter).includes(bin),
  }
}

export const defaultHome = (): string => os.homedir()
