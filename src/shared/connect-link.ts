// openmail://connect?url=http://nas.local:8787 pre-fills the server address on the sign-in screen.

/** The server address in a connect link, or null when the link is something else or the address is not http(s). */
export function parseConnectLink(link: string): string | null {
  const m = /^openmail:\/\/connect\?(.*)$/i.exec(link.trim())
  if (!m) return null
  const url = new URLSearchParams(m[1]).get('url')
  if (!url) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `http://${url}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}
