// The browser session of the home server: one HttpOnly cookie holding the device token.
// Sessions opened before the rename carry `octo_token` and a page that still sends `X-Octo`; both keep working.
import type { IncomingHttpHeaders } from 'node:http'

export const SESSION_COOKIE = 'openmail_token'
export const LEGACY_SESSION_COOKIE = 'octo_token'

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header || '').split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue
    const raw = part.slice(eq + 1).trim()
    if (!raw) continue
    try {
      return decodeURIComponent(raw)
    } catch {
      return null
    }
  }
  return null
}

/** The new cookie first, then the legacy one. */
export function sessionToken(header: string | undefined): string | null {
  return readCookie(header, SESSION_COOKIE) ?? readCookie(header, LEGACY_SESSION_COOKIE)
}

const attrs = (maxAge: number, secure: boolean): string => `; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`

/** Login sets only the new cookie. */
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}${attrs(31536000, secure)}`
}

/** Logout and "sign out everywhere" clear both names. */
export function clearSessionCookies(secure: boolean): string[] {
  return [SESSION_COOKIE, LEGACY_SESSION_COOKIE].map((name) => `${name}=${attrs(0, secure)}`)
}

/** Cookie-authenticated writes must carry our own header (a custom header cannot come from a cross-site form). */
export function isAppRequest(headers: IncomingHttpHeaders): boolean {
  return headers['x-openmail'] === '1' || headers['x-octo'] === '1'
}
