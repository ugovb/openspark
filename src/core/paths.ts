import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env } from '../shared/env'
import { migrateLegacyProfile, NEW_DIR } from './migrate'

function ensure(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Per-user configuration root of the operating system (same place Electron uses for userData). */
export function platformConfigDir(): string {
  if (process.platform === 'win32') return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support')
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
}

let resolved: string | null = null

/** Root data directory shared by the desktop app, the CLI and the MCP server. */
export function dataDir(): string {
  const home = env('HOME')
  if (home) return ensure(home)
  if (resolved) return ensure(resolved)
  // a profile from the Octopus Mail days is copied once, before anything opens the database
  migrateLegacyProfile(platformConfigDir())
  resolved = path.join(platformConfigDir(), NEW_DIR)
  return ensure(resolved)
}

/** `openmail.db`; a data folder that still has the old `octopus.db` (a server volume) keeps using it. */
export const dbPath = (): string => {
  const dir = dataDir()
  const next = path.join(dir, 'openmail.db')
  const old = path.join(dir, 'octopus.db')
  return !fs.existsSync(next) && fs.existsSync(old) ? old : next
}
export const attachmentsDir = (): string => ensure(path.join(dataDir(), 'attachments'))
export const logsDir = (): string => ensure(path.join(dataDir(), 'logs'))
export const tmpDir = (): string => ensure(path.join(dataDir(), 'tmp'))
