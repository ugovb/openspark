// Credentials live in the operating system's secret store, never in the database:
// Windows Credential Manager, macOS Keychain, Linux Secret Service (GNOME Keyring / KWallet).
// Linux machines without a Secret Service (servers, minimal desktops) fall back to a file
// readable only by the owner. Test/demo profiles never touch real credentials:
// OCTO_SECRETS=memory keeps them in-process, OCTO_SECRETS=file keeps them in <data dir>/secrets.dev.json.
// A home server (systemd/Docker, no desktop session) sets OCTO_SECRETS=server: always the private file.
import fs from 'node:fs'
import path from 'node:path'
import { Entry } from '@napi-rs/keyring'
import { t } from '../shared/i18n'
import { dataDir } from './paths'
import { env } from '../shared/env'

const SERVICE = 'OpenMail'
const LEGACY_SERVICE = 'Octopus Mail' // read as a fallback and copied over; never deleted by the migration
const memory = new Map<string, string>()
let fileFallback = false
/** mtime of the secrets file when it was last read (-1 = never): other processes (CLI, server) may change it */
let loadedMtime = -1

const mode = () => env('SECRETS')
const usesFile = () => mode() === 'file' || mode() === 'server' || fileFallback
const filePath = () => path.join(dataDir(), mode() === 'file' ? 'secrets.dev.json' : 'secrets.json')

function loadFile(): void {
  let mtime = 0
  try {
    mtime = fs.statSync(filePath()).mtimeMs
  } catch {
    /* no file yet */
  }
  if (mtime === loadedMtime) return
  loadedMtime = mtime
  memory.clear()
  try {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(filePath(), 'utf8')) as Record<string, string>)) memory.set(k, v)
  } catch {
    /* first use */
  }
}

function persist(): void {
  if (!usesFile()) return
  fs.writeFileSync(filePath(), JSON.stringify(Object.fromEntries(memory), null, 1), { mode: 0o600 })
  loadedMtime = fs.statSync(filePath()).mtimeMs
}

/** Linux without a running Secret Service: remember that and use the private file from now on. */
function switchToFile(e: unknown): void {
  if (process.platform !== 'linux') throw e
  if (!fileFallback) {
    fileFallback = true
    loadedMtime = -1
    console.warn(`[secrets] No Secret Service (${(e as Error).message}) — storing passwords in ${filePath()} (owner-only).`)
  }
  loadFile()
}

/** Where secrets are kept, phrased to follow "Passwords are stored …" ("przechowywane …") in UI messages. */
export function secretStoreName(): string {
  if (mode() === 'memory' || mode() === 'file') return t('in the test profile')
  if (mode() === 'server') return t('on the home server, in a file only its owner can read')
  if (fileFallback) return t('in a file only you can read')
  if (process.platform === 'win32') return t('in Windows Credential Manager')
  if (process.platform === 'darwin') return t('in the macOS Keychain')
  return t('in the system password store (GNOME Keyring / KWallet)')
}

function entry(key: string, service = SERVICE): Entry {
  return new Entry(service, key)
}

interface KeychainIo {
  getNew(): string | null
  getOld(): string | null
  setNew(value: string): void
}

/** Value under the new service name; else the old one, copied to the new name (the old entry stays). */
export function readMigrating(io: KeychainIo): string | null {
  const v = io.getNew()
  if (v !== null) return v
  const old = io.getOld()
  if (old === null) return null
  try {
    io.setNew(old)
    // trust the copy only after reading it back; a failed write just leaves the old entry in use
    if (io.getNew() !== old) return old
  } catch {
    /* the old entry keeps serving */
  }
  return old
}

const keychainIo = (key: string): KeychainIo => ({
  getNew: () => entry(key).getPassword() ?? null,
  getOld: () => entry(key, LEGACY_SERVICE).getPassword() ?? null,
  setNew: (value) => entry(key).setPassword(value),
})

export function setSecret(key: string, value: string): void {
  if (mode() === 'memory') {
    memory.set(key, value)
    return
  }
  if (!usesFile()) {
    try {
      entry(key).setPassword(value)
      return
    } catch (e) {
      switchToFile(e)
    }
  }
  loadFile()
  memory.set(key, value)
  persist()
}

export function getSecret(key: string): string | null {
  if (mode() === 'memory') return memory.get(key) ?? null
  if (!usesFile()) {
    try {
      return readMigrating(keychainIo(key))
    } catch (e) {
      // "no entry" is a normal miss; anything else on Linux means the store itself is missing
      if (process.platform !== 'linux' || /no (matching )?entry|not found/i.test((e as Error).message)) return null
      switchToFile(e)
    }
  }
  loadFile()
  return memory.get(key) ?? null
}

export function deleteSecret(key: string): void {
  if (mode() === 'memory') {
    memory.delete(key)
    return
  }
  if (!usesFile()) {
    for (const service of [SERVICE, LEGACY_SERVICE]) {
      try {
        entry(key, service).deletePassword()
      } catch {
        /* not present */
      }
    }
    return
  }
  loadFile()
  memory.delete(key)
  persist()
}

export const accountSecretKey = (accountId: number): string => `account:${accountId}`
export const oauthSecretKey = (accountId: number): string => `oauth:${accountId}`
export const calSourceSecretKey = (sourceId: number): string => `calsource:${sourceId}`
export const claudeKeyName = 'anthropic-api-key'
export const openaiKeyName = 'openai-compatible-api-key'
export const anthropicCompatKeyName = 'anthropic-compatible-api-key'
export const totpKeyName = 'server-totp-key'
