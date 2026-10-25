// What the desktop app says to a home server before it has a saved sign-in: probe, create the account,
// sign in with a code. No Electron imports, so the tests can run it against a real server.
import { t } from '../shared/i18n'
import { decodeWire, encodeWire } from '../shared/wire'

export interface RemoteConfig {
  url: string
  token: string
  deviceId: string
  deviceName: string
  serverName?: string
}

export interface ProbeInfo {
  hostname: string
  version: string
  /** an owner account exists */
  account?: boolean
  /** no account yet: the setup code creates it */
  setup?: boolean
  pairing?: boolean
}

export function normalizeServerUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  const parsed = new URL(u)
  if (!parsed.port && parsed.protocol === 'http:') parsed.port = '8787'
  return parsed.toString().replace(/\/+$/, '')
}

export async function probeServer(url: string): Promise<ProbeInfo> {
  const u = normalizeServerUrl(url)
  let r: Response
  try {
    r = await fetch(`${u}/api/info`, { signal: AbortSignal.timeout(6000) })
  } catch (e) {
    throw new Error(t("Can't connect to {url}: {error}", { url: u, error: (e as Error).message }))
  }
  const j = (await r.json().catch(() => ({}))) as ProbeInfo & { name?: string }
  if (j.name !== 'openmail-server') throw new Error(t('{url} is not an OpenMail server', { url: u }))
  return j
}

type Signed = { token?: string; device?: { id: string; name: string }; error?: string }
const toConfig = (u: string, j: Signed, hostname: string): RemoteConfig => ({ url: u, token: j.token!, deviceId: j.device!.id, deviceName: j.device!.name, serverName: hostname })

/** First account of a fresh server: the setup code, an email and a password. Signs this device in. */
export async function createServerAccount(url: string, email: string, password: string, setupCode: string, deviceName: string): Promise<RemoteConfig> {
  const u = normalizeServerUrl(url)
  const info = await probeServer(u)
  const r = await fetch(`${u}/api/auth/setup`, { method: 'POST', body: encodeWire({ code: setupCode, email, password, name: deviceName }) })
  const j = decodeWire<Signed>(await r.text())
  if (!j.token || !j.device) throw new Error(j.error || t('Could not create the account (HTTP {status})', { status: r.status }))
  return toConfig(u, j, info.hostname)
}

export interface CodeLogin {
  url: string
  userCode: string
  deviceCode: string
  expires: number
  interval: number
}

/** Ask the server for a code to show on this device. Another signed-in device approves it. */
export async function startCodeLogin(url: string, deviceName: string): Promise<CodeLogin> {
  const u = normalizeServerUrl(url)
  await probeServer(u)
  const r = await fetch(`${u}/api/auth/device/start`, { method: 'POST', body: encodeWire({ name: deviceName }) })
  const j = decodeWire<Partial<CodeLogin> & { error?: string }>(await r.text())
  if (!j.userCode || !j.deviceCode) throw new Error(j.error || t('Could not start the sign-in (HTTP {status})', { status: r.status }))
  return { url: u, userCode: j.userCode, deviceCode: j.deviceCode, expires: j.expires!, interval: j.interval || 2 }
}

export type CodePoll = { status: 'pending' | 'denied' | 'expired' } | { status: 'approved'; cfg: RemoteConfig }

export async function pollCodeLogin(url: string, deviceCode: string): Promise<CodePoll> {
  const u = normalizeServerUrl(url)
  const r = await fetch(`${u}/api/auth/device/poll`, { method: 'POST', body: encodeWire({ deviceCode }) })
  const j = decodeWire<Signed & { status?: string }>(await r.text())
  if (j.error) throw new Error(j.error)
  if (j.status === 'approved' && j.token && j.device) return { status: 'approved', cfg: toConfig(u, j, (await probeServer(u)).hostname) }
  if (j.status === 'denied' || j.status === 'expired') return { status: j.status }
  return { status: 'pending' }
}
