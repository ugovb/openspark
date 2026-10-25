// "My account" on the home server's settings page: create the owner account, change the password,
// two-step verification (QR code + recovery codes), pairing codes, sign out everywhere.
import { Copy, Download, KeyRound, MonitorSmartphone, ShieldCheck, ShieldOff, UserRound } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { type ReactNode, useEffect, useState } from 'react'
import { Button, cx, Field, inputCls, Modal, Spinner, Toggle } from '../components/ui'
import { errorText } from '../lib/api'
import { useStore } from '../lib/store'
import { t } from '../../../shared/i18n'

interface AccountUser {
  id: number
  email: string
  totpEnabled: boolean
  recoveryLeft: number
  createdAt: number
  passwordChangedAt: number
}
interface AccountInfo {
  account: boolean
  user: AccountUser | null
  allowPairing: boolean
}

const call = <T,>(path: string, body?: Record<string, unknown>): Promise<T> => window.openmail.serverAccount(path, body) as Promise<T>

function Block({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-0.5 text-[13px] font-semibold text-muted">{title}</div>
      {hint && <div className="mb-1 text-[12.5px] text-muted">{hint}</div>}
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function Row({ icon, title, hint, children }: { icon: ReactNode; title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-0 max-md:flex-wrap">
      <span className="flex w-6 shrink-0 justify-center text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{title}</div>
        {hint && <div className="text-[12px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

/** Password (and the 2FA code when it is on) asked again before a security change. */
function Confirm({ title, needCode, onRun, onClose }: { title: string; needCode: boolean; onRun: (password: string, code: string) => Promise<void>; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true)
    setError('')
    try {
      await onRun(password, code)
      onClose()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  const ready = password.length > 0 && (!needCode || code.trim().length >= 6)
  return (
    <Modal open onClose={onClose} title={title} width={420}
      footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={busy || !ready} onClick={() => void go()}>{busy && <Spinner />} {t('Confirm')}</Button></>}>
      <form className="p-5" onSubmit={(e) => (e.preventDefault(), ready && void go())}>
        <div className="mb-2 text-[12.5px] text-muted">{t('For your security, enter your password again.')}</div>
        <Field label={t('Password')}>
          <input className={inputCls} type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {needCode && (
          <Field label={t('Code from your authenticator app (or a recovery code)')}>
            <input className={cx(inputCls, 'tracking-widest')} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        )}
        {error && <div className="mt-2 text-[12.5px] text-danger" role="alert">{error}</div>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const toast = useStore((s) => s.toast)
  const text = codes.join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    toast({ level: 'success', message: t('Copied') })
  }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`OpenSpark — ${t('recovery codes')}\n\n${text}\n`], { type: 'text/plain' }))
    a.download = 'openspark-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Modal open onClose={() => undefined} title={t('Your recovery codes')} width={460}
      footer={<Button variant="primary" onClick={onDone}>{t('I saved them')}</Button>}>
      <div className="p-5">
        <div className="mb-3 text-[13px] leading-relaxed">{t('Each code works once if you lose your phone. They are shown only now: keep them somewhere safe, outside this server.')}</div>
        <div className="selectable grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-surface-2 px-4 py-3 font-mono text-[14px] tabular">
          {codes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => void copy()}><Copy size={14} /> {t('Copy')}</Button>
          <Button size="sm" onClick={download}><Download size={14} /> {t('Download')}</Button>
        </div>
      </div>
    </Modal>
  )
}

function SetupTotp({ secret, uri, onConfirmed, onClose }: { secret: string; uri: string; onConfirmed: (codes: string[]) => void; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const svg = (() => {
    const qr = qrcode(0, 'M')
    qr.addData(uri)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  })()
  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await call<{ recovery: string[] }>('/api/account/totp/confirm', { code })
      onConfirmed(r.recovery)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  const spaced = secret.replace(/(.{4})/g, '$1 ').trim()
  return (
    <Modal open onClose={onClose} title={t('Turn on two-step verification')} width={460}
      footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={busy || code.trim().length < 6} onClick={() => void go()}>{busy && <Spinner />} {t('Verify and turn on')}</Button></>}>
      <form className="p-5" onSubmit={(e) => (e.preventDefault(), code.trim().length >= 6 && void go())}>
        <div className="mb-3 text-[13px] leading-relaxed">{t('1. Scan this code with an authenticator app (Google Authenticator, 1Password, Authy…).')}</div>
        <div className="mx-auto mb-3 w-[190px] rounded-xl bg-white p-3" aria-label={t('QR code')} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="mb-4 text-center text-[12px] text-muted">
          {t('Or type this key:')} <code className="selectable font-mono text-[12.5px] text-fg">{spaced}</code>
        </div>
        <div className="mb-1 text-[13px] leading-relaxed">{t('2. Enter the 6-digit code it shows.')}</div>
        <input className={cx(inputCls, 'text-center text-[20px] tracking-[0.4em]')} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <div className="mt-2 text-[12.5px] text-danger" role="alert">{error}</div>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

function CreateAccount({ onDone }: { onDone: (i: AccountInfo) => void }) {
  const toast = useStore((s) => s.toast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const mismatch = again.length > 0 && again !== password
  const go = async () => {
    setBusy(true)
    try {
      onDone(await call<AccountInfo>('/api/account/create', { email, password }))
      toast({ level: 'success', message: t('Account created. Turn on two-step verification to protect it.') })
    } catch (e) {
      toast({ level: 'error', message: errorText(e) })
      setBusy(false)
    }
  }
  return (
    <Block title={t('My account')} hint={t('Create the account you will use to sign in on every device: your phone, your browser and the desktop app. Only you can create it, and sign-up closes afterwards.')}>
      <div className="grid grid-cols-2 gap-x-4 max-md:grid-cols-1">
        <Field label={t('Email')}>
          <input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <span />
        <Field label={t('Password')} hint={t('At least 10 characters.')}>
          <input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('Repeat the password')} hint={mismatch ? t('The passwords do not match.') : undefined}>
          <input className={cx(inputCls, mismatch && 'border-danger')} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
      </div>
      <div className="pt-2">
        <Button variant="primary" disabled={busy || !email.includes('@') || password.length < 10 || password !== again} onClick={() => void go()}>
          {busy && <Spinner />} {t('Create account')}
        </Button>
      </div>
    </Block>
  )
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ok = current.length > 0 && next.length >= 10 && next === again
  const go = async () => {
    setBusy(true)
    setError('')
    try {
      await call('/api/account/password', { current, next })
      toast({ level: 'success', message: t('Password changed') })
      onClose()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title={t('Change password')} width={420}
      footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={busy || !ok} onClick={() => void go()}>{busy && <Spinner />} {t('Change password')}</Button></>}>
      <form className="p-5" onSubmit={(e) => (e.preventDefault(), ok && void go())}>
        <Field label={t('Current password')}>
          <input className={inputCls} type="password" autoFocus autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label={t('New password')} hint={t('At least 10 characters.')}>
          <input className={inputCls} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label={t('Repeat the password')} hint={again && again !== next ? t('The passwords do not match.') : undefined}>
          <input className={inputCls} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {error && <div className="mt-2 text-[12.5px] text-danger" role="alert">{error}</div>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/** Another device shows a code; type it here, check which device it is, confirm with the password. */
function ApproveDevice({ needCode, onClose }: { needCode: boolean; onClose: () => void }) {
  const toast = useStore((s) => s.toast)
  const [userCode, setUserCode] = useState('')
  const [device, setDevice] = useState<{ name: string; ip: string | null; createdAt: number } | null>(null)
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const lookup = () => run(async () => setDevice(await call<{ name: string; ip: string | null; createdAt: number }>('/api/account/device/lookup', { userCode })))
  const approve = () =>
    run(async () => {
      await call('/api/account/device/approve', { userCode, password, code: totp })
      toast({ level: 'info', message: t('Device approved: it is signed in now') })
      onClose()
    })
  const deny = () =>
    run(async () => {
      await call('/api/account/device/deny', { userCode })
      onClose()
    })
  const ready = password.length > 0 && (!needCode || totp.trim().length >= 6)
  return (
    <Modal open onClose={onClose} title={t('Approve a device')} width={420}
      footer={device
        ? <><Button variant="ghost" disabled={busy} onClick={() => void deny()}>{t('Refuse')}</Button><Button variant="primary" disabled={busy || !ready} onClick={() => void approve()}>{busy && <Spinner />} {t('Approve')}</Button></>
        : <><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={busy || userCode.replace(/[\s-]/g, '').length < 8} onClick={() => void lookup()}>{busy && <Spinner />} {t('Continue')}</Button></>}>
      <form className="p-5" onSubmit={(e) => (e.preventDefault(), device ? ready && void approve() : void lookup())}>
        {!device ? (
          <Field label={t('Code shown on the other device')}>
            <input className={cx(inputCls, 'uppercase tracking-widest')} placeholder="XXXX-XXXX" autoFocus maxLength={9} value={userCode} onChange={(e) => setUserCode(e.target.value)} />
          </Field>
        ) : (
          <>
            <div className="mb-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]">
              <div className="font-medium">{device.name}</div>
              <div className="text-[12px] text-muted">{device.ip || ''}</div>
            </div>
            <div className="mb-2 text-[12.5px] text-muted">{t('Only approve a device that is yours: it will see all your mail. For your security, enter your password again.')}</div>
            <Field label={t('Password')}>
              <input className={inputCls} type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {needCode && (
              <Field label={t('Code from your authenticator app (or a recovery code)')}>
                <input className={cx(inputCls, 'tracking-widest')} inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(e) => setTotp(e.target.value)} />
              </Field>
            )}
          </>
        )}
        {error && <div className="mt-2 text-[12.5px] text-danger" role="alert">{error}</div>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

export default function AccountSection() {
  const toast = useStore((s) => s.toast)
  const [info, setInfo] = useState<AccountInfo | null>(null)
  const [dialog, setDialog] = useState<
    | { kind: 'password' }
    | { kind: 'confirm'; title: string; needCode: boolean; run: (pw: string, code: string) => Promise<void> }
    | { kind: 'totp'; secret: string; uri: string }
    | { kind: 'codes'; codes: string[] }
    | { kind: 'approve' }
    | null
  >(null)
  const load = () => void call<AccountInfo>('/api/account').then(setInfo).catch((e) => toast({ level: 'error', message: errorText(e) }))
  useEffect(load, [])
  if (!info) return <Spinner />
  if (!info.account) return <CreateAccount onDone={setInfo} />
  const user = info.user
  if (!user) {
    return (
      <Block title={t('My account')}>
        <div className="py-2 text-[13px] text-muted">{t('Sign in with your email and password on this device to manage the account.')}</div>
      </Block>
    )
  }

  const confirm = (title: string, needCode: boolean, run: (pw: string, code: string) => Promise<void>) => setDialog({ kind: 'confirm', title, needCode, run })

  return (
    <>
      <Block title={t('My account')}>
        <Row icon={<UserRound size={18} />} title={user.email} hint={t('Owner of this server')}>
          <Button size="sm" onClick={() => setDialog({ kind: 'password' })}><KeyRound size={14} /> {t('Change password')}</Button>
        </Row>
        <Row
          icon={user.totpEnabled ? <ShieldCheck size={18} className="text-success" /> : <ShieldOff size={18} className="text-warning" />}
          title={t('Two-step verification')}
          hint={user.totpEnabled ? t('On · {n} recovery codes left', { n: user.recoveryLeft }) : t('Off — a code from your phone will be asked at every sign-in once it is on.')}
        >
          {user.totpEnabled ? (
            <>
              <Button size="sm" onClick={() => confirm(t('New recovery codes'), true, async (password, code) => {
                const r = await call<{ recovery: string[] }>('/api/account/recovery', { password, code })
                setDialog({ kind: 'codes', codes: r.recovery })
                load()
              })}>{t('New recovery codes')}</Button>
              <Button size="sm" variant="danger" onClick={() => confirm(t('Turn off two-step verification'), true, async (password, code) => {
                await call('/api/account/totp/disable', { password, code })
                toast({ level: 'info', message: t('Two-step verification is off') })
                load()
              })}>{t('Turn off')}</Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={() => confirm(t('Turn on two-step verification'), false, async (password) => {
              const r = await call<{ secret: string; uri: string }>('/api/account/totp/begin', { password })
              // the confirmation dialog closes itself after this resolves; open the setup one right after
              setTimeout(() => setDialog({ kind: 'totp', secret: r.secret, uri: r.uri }), 0)
            })}>{t('Turn on')}</Button>
          )}
        </Row>
        <Row icon={<MonitorSmartphone size={18} />} title={t('Approve a device')} hint={t('On the new device choose “Sign in with a code”, then type the code it shows here. No password to type on that device.')}>
          <Button size="sm" variant="primary" onClick={() => setDialog({ kind: 'approve' })}>{t('Enter a code')}</Button>
        </Row>
        <Row icon={<KeyRound size={18} />} title={t('Pairing codes')} hint={t('Let a new device connect with a one-time code instead of the password. Off by default: sign in with your email.')}>
          <Toggle checked={info.allowPairing} onChange={(v) => confirm(v ? t('Allow pairing codes') : t('Switch off pairing codes'), true, async (password, code) => {
            setInfo(await call<AccountInfo>('/api/account/pairing', { allow: v, password, code }))
          })} />
        </Row>
        <Row icon={<ShieldOff size={18} />} title={t('Sign out everywhere')} hint={t('Every device, including this one, has to sign in again.')}>
          <Button size="sm" variant="danger" onClick={() => confirm(t('Sign out everywhere'), true, async (password, code) => {
            await call('/api/account/revoke-all', { password, code })
          })}>{t('Sign out all devices')}</Button>
        </Row>
      </Block>

      {dialog?.kind === 'password' && <ChangePassword onClose={() => setDialog(null)} />}
      {dialog?.kind === 'confirm' && <Confirm title={dialog.title} needCode={dialog.needCode && user.totpEnabled} onRun={dialog.run} onClose={() => setDialog((d) => (d?.kind === 'confirm' ? null : d))} />}
      {dialog?.kind === 'totp' && (
        <SetupTotp
          secret={dialog.secret}
          uri={dialog.uri}
          onClose={() => setDialog(null)}
          onConfirmed={(codes) => {
            setDialog({ kind: 'codes', codes })
            load()
          }}
        />
      )}
      {dialog?.kind === 'approve' && <ApproveDevice needCode={user.totpEnabled} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'codes' && <RecoveryCodes codes={dialog.codes} onDone={() => setDialog(null)} />}
    </>
  )
}
