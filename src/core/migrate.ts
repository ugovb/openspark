// First launch after the rename: copy the old "Octopus Mail" profile to "OpenMail". The old folder is never
// touched, so a failed or interrupted copy loses nothing. The copy goes to a temporary folder and is renamed
// into place in one step; a lock folder keeps the app, the CLI and the server from copying at the same time.
import fs from 'node:fs'
import path from 'node:path'

export const LEGACY_DIR = 'Octopus Mail'
export const NEW_DIR = 'OpenMail'
const LOCK_STALE_MS = 10 * 60_000

export interface Migration {
  migrated: boolean
  from?: string
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Copies `<configDir>/Octopus Mail` to `<configDir>/OpenMail` when only the old one exists. */
export function migrateLegacyProfile(configDir: string): Migration {
  const legacy = path.join(configDir, LEGACY_DIR)
  const dest = path.join(configDir, NEW_DIR)
  if (fs.existsSync(dest) || !fs.existsSync(legacy)) return { migrated: false }

  const lock = `${dest}.lock`
  try {
    fs.mkdirSync(lock)
  } catch {
    // another process is copying: wait for it (or for a stale lock to be old enough to take over)
    const until = Date.now() + LOCK_STALE_MS
    while (Date.now() < until) {
      if (fs.existsSync(dest)) return { migrated: false }
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true })
      } catch {
        /* lock released meanwhile */
      }
      try {
        fs.mkdirSync(lock)
        break
      } catch {
        sleep(200)
      }
    }
    if (fs.existsSync(dest)) {
      fs.rmSync(lock, { recursive: true, force: true })
      return { migrated: false }
    }
  }

  const tmp = `${dest}.tmp-${process.pid}`
  try {
    if (fs.existsSync(dest)) return { migrated: false }
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.cpSync(legacy, tmp, { recursive: true })
    // the database was renamed with the product; sqlite files travel together
    for (const suffix of ['', '-wal', '-shm']) {
      const old = path.join(tmp, `octopus.db${suffix}`)
      if (fs.existsSync(old)) fs.renameSync(old, path.join(tmp, `openmail.db${suffix}`))
    }
    fs.renameSync(tmp, dest)
    return { migrated: true, from: legacy }
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true })
    throw e
  } finally {
    fs.rmSync(lock, { recursive: true, force: true })
  }
}

/** Where the old profile still sits (for Settings), or null when there is none. */
export function legacyProfilePath(configDir: string): string | null {
  const legacy = path.join(configDir, LEGACY_DIR)
  return fs.existsSync(legacy) && fs.existsSync(path.join(configDir, NEW_DIR)) ? legacy : null
}
