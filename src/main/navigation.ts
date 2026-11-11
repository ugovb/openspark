import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** True only for the app's own UI: the dev server origin, or the bundled renderer index file. */
export function isInternalUrl(url: string, app: { devUrl?: string; indexFile: string }): boolean {
  try {
    const u = new URL(url)
    if (app.devUrl && u.origin === new URL(app.devUrl).origin) return true
    if (u.protocol === 'file:') return fileURLToPath(u) === path.resolve(app.indexFile)
    return false
  } catch {
    return false
  }
}
