// First run: sign in to the OpenMail account of a home server (which holds every mailbox), create it on a
// fresh server, sign in with a code approved from another device, or skip all that and stay on this computer.
import { useEffect, useRef, useState } from 'react'
import { t } from '../../../shared/i18n'
import logo from '../assets/logo.svg'
import { Button, cx, Field, inputCls, Spinner } from '../components/ui'
import { errorText } from '../lib/api'

type Probe = { hostname: string; version: string; account?: boolean; setup?: boolean }
type Mode = 'address' | 'signin' | 'totp' | 'create' | 'code'

const SERVER_KEY = 'openmail.server'
const remembered = () => {
  try {
    return localStorage.getItem(SERVER_KEY) || ''
  } catch {
    return ''
  }
}
const remember = (url: string) => {
  try {
    localStorage.setItem(SERVER_KEY, url)
  } catch {
    /* private window: nothing to remember */
  }
}

/** `openmail://connect?url=…` (or a pasted address) pre-fills the server field. */
export function SignInScreen({ onLocal, initialUrl }: { onLocal: () => void; initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl || remembered())
  const [mode, setMode] = useState<Mode>('address')
  const [probe, setProbe] = useState<Probe | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [setupCode, setSetupCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [totp, setTotp] = useState('')
  const [code, setCode] = useState<{ userCode: string; deviceCode: string; interval: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stop = useRef(false)

  useEffect(() => () => void (stop.current = true), [])

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

  const contact = () =>
    run(async () => {
      const info = (await window.openmail.serverProbe(url)) as Probe
      remember(url.trim())
      setProbe(info)
      setMode(info.setup ? 'create' : 'signin')
    })

  const signIn = () =>
    run(async () => {
      if (mode === 'totp') {
        await window.openmail.serverLogin2fa(url, ticket, totp)
        return
      }
      const r = (await window.openmail.serverLogin(url, email, password, '')) as { needs2fa?: boolean; ticket?: string } | undefined
      if (r?.needs2fa && r.ticket) {
        setTicket(r.ticket)
        setMode('totp')
      }
    })

  const create = () =>
    run(async () => {
      if (password !== password2) throw new Error(t('The passwords do not match.'))
      await window.openmail.serverCreateAccount(url, email, password, setupCode, '')
    })

  const startCode = () =>
    run(async () => {
      stop.current = false
      const s = (await window.openmail.serverCodeStart(url, '')) as { userCode: string; deviceCode: string; interval: number }
      setCode(s)
      setMode('code')
      const tick = async (): Promise<void> => {
        if (stop.current) return
        try {
          const r = (await window.openmail.serverCodePoll(url, s.deviceCode)) as { status: string }
          if (r.status === 'approved') return // the app restarts into the signed-in view
          if (r.status === 'denied' || r.status === 'expired') {
            setCode(null)
            setMode('signin')
            setError(r.status === 'denied' ? t('The other device refused this sign-in.') : t('This sign-in expired. Start again.'))
            return
          }
        } catch (e) {
          setError(errorText(e))
        }
        setTimeout(() => void tick(), (s.interval || 2) * 1000)
      }
      setTimeout(() => void tick(), (s.interval || 2) * 1000)
    })

  const back = () => {
    stop.current = true
    setCode(null)
    setError('')
    setTicket('')
    setTotp('')
    setMode('address')
  }

  const enter = (fn: () => void, ok: boolean) => (e: React.KeyboardEvent) => e.key === 'Enter' && ok && !busy && fn()
  const canSignIn = email.includes('@') && password.length > 0
  const canCreate = email.includes('@') && password.length >= 10 && password2.length >= 10 && setupCode.replace(/[\s-]/g, '').length >= 8

  return (
    <div className="flex h-full w-full justify-center overflow-y-auto bg-bg pt-[8vh] max-md:pt-6">
      <div className="mx-4 w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 max-md:p-5" style={{ boxShadow: 'var(--shadow)', height: 'fit-content' }}>
        <div className="mb-5 text-center">
          <img src={logo} alt="" className="mx-auto mb-3 h-14 w-14" draggable={false} />
          <h1 className="text-[22px] font-semibold">
            {mode === 'create' ? t('Create your OpenMail account') : mode === 'code' ? t('Sign in with a code') : t('Sign in to OpenMail')}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {mode === 'code'
              ? t('On a device where you are signed in to OpenMail, open Settings → Home server → Approve a device and enter this code.')
              : mode === 'create'
                ? t('This server has no account yet. Choose the email and password you will use on every device.')
                : t('One account for all your mailboxes, on your own server, on every device.')}
          </p>
        </div>

        {mode === 'address' && (
          <>
            <Field label={t('Server address')}>
              <input
                className={inputCls}
                autoFocus
                placeholder={t('e.g. 192.168.1.50 or raspberrypi.local')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={enter(() => void contact(), !!url.trim())}
              />
            </Field>
            <Button variant="primary" className="mt-2 w-full" disabled={busy || !url.trim()} onClick={() => void contact()}>
              {busy && <Spinner />} {t('Continue')}
            </Button>
          </>
        )}

        {mode === 'signin' && (
          <>
            <div className="mb-1 text-[12.5px] text-muted">{t('Server: {name}', { name: probe?.hostname || url })}</div>
            <Field label={t('Email')}>
              <input className={inputCls} type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t('Password')}>
              <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={enter(() => void signIn(), canSignIn)} />
            </Field>
            <Button variant="primary" className="mt-2 w-full" disabled={busy || !canSignIn} onClick={() => void signIn()}>
              {busy && <Spinner />} {t('Sign in')}
            </Button>
            <button className="mt-3 block w-full text-center text-[12.5px] text-accent hover:underline" onClick={() => void startCode()}>
              {t('Sign in with a code from another device')}
            </button>
          </>
        )}

        {mode === 'totp' && (
          <>
            <Field label={t('Code from your authenticator app (or a recovery code)')}>
              <input className={cx(inputCls, 'tracking-widest')} inputMode="numeric" autoComplete="one-time-code" autoFocus value={totp} onChange={(e) => setTotp(e.target.value)} onKeyDown={enter(() => void signIn(), totp.trim().length >= 6)} />
            </Field>
            <Button variant="primary" className="mt-2 w-full" disabled={busy || totp.trim().length < 6} onClick={() => void signIn()}>
              {busy && <Spinner />} {t('Verify')}
            </Button>
          </>
        )}

        {mode === 'create' && (
          <>
            <Field label={t('Setup code')} hint={t('The setup code is in the server log, or in OPENMAIL_SETUP_CODE.')}>
              <input className={cx(inputCls, 'uppercase tracking-widest')} autoFocus placeholder="XXXX-XXXX" maxLength={64} value={setupCode} onChange={(e) => setSetupCode(e.target.value)} />
            </Field>
            <Field label={t('Email')}>
              <input className={inputCls} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t('Password')} hint={t('Use at least {n} characters.', { n: 10 })}>
              <input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t('Repeat the password')}>
              <input className={inputCls} type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} onKeyDown={enter(() => void create(), canCreate)} />
            </Field>
            <Button variant="primary" className="mt-2 w-full" disabled={busy || !canCreate} onClick={() => void create()}>
              {busy && <Spinner />} {t('Create account')}
            </Button>
          </>
        )}

        {mode === 'code' && code && (
          <div className="text-center">
            <div className="selectable my-3 font-mono text-[34px] font-semibold tracking-[0.18em]">{code.userCode}</div>
            <div className="flex items-center justify-center gap-2 text-[13px] text-muted">
              <Spinner /> {t('Waiting for approval…')}
            </div>
          </div>
        )}

        {error && <div className="mt-3 text-[12.5px] text-danger" role="alert">{error}</div>}

        <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-[12.5px]">
          {mode !== 'address' ? (
            <button className="text-accent hover:underline" onClick={back}>{t('Use another server')}</button>
          ) : (
            <span />
          )}
          <button className="text-muted hover:text-fg hover:underline" onClick={onLocal}>{t('Use only on this computer')}</button>
        </div>
      </div>
    </div>
  )
}
