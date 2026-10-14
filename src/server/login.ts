// Sign-in page of the home server's web UI, shown in the browser's language (Accept-Language).
import { detectLang, getLang, setLang, t, type Lang } from '../shared/i18n'

/** Accept-Language header → the most preferred supported UI language; English when neither is listed. */
export function langFromAcceptLanguage(header: string | string[] | undefined | null): Lang {
  const raw = Array.isArray(header) ? header.join(',') : header || ''
  const prefs = raw
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim().match(/^q=([\d.]+)$/i)).find(Boolean)
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q[1]) : 1, i }
    })
    .filter((p) => p.tag && p.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  for (const p of prefs) {
    if (/^en\b/.test(p.tag)) return 'en'
    const l = detectLang(p.tag)
    if (l !== 'en') return l
  }
  return 'en'
}

/** Run synchronous code with the UI language switched for one request (restored afterwards). */
export function withLang<T>(lang: Lang, fn: () => T): T {
  const prev = getLang()
  setLang(lang)
  try {
    return fn()
  } finally {
    setLang(prev)
  }
}

/** Default name of a browser paired through the sign-in page, e.g. "Phone (192.168.1.20)". */
export function browserDeviceName(lang: Lang, userAgent: string, ip: string): string {
  return withLang(lang, () => {
    const kind = /iphone|android|mobile/i.test(userAgent) ? t('Phone') : t('Browser')
    return `${kind} (${ip})`
  })
}

export type LoginError = 'too-many' | 'bad-code' | 'invalid' | 'locked' | 'bad-totp' | 'expired' | 'account-exists'

export type AuthView =
  | { view: 'login'; error?: LoginError | { text: string }; email?: string; allowPairing?: boolean }
  | { view: 'totp'; ticket: string; error?: LoginError | { text: string } }
  | { view: 'setup'; error?: LoginError | { text: string }; email?: string }
  | { view: 'pair'; error?: LoginError | { text: string }; hasOwner?: boolean }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Message for an error key in the current language (the server's own for JSON replies). */
export function authMessage(e: LoginError): string {
  return errorText(e)
}

function errorText(e: LoginError | { text: string } | undefined): string {
  if (!e) return ''
  if (typeof e === 'object') return esc(e.text)
  return {
    'too-many': t('Too many attempts — wait 10 minutes.'),
    'bad-code': t('Invalid or expired code.'),
    invalid: t('Wrong email or password.'),
    locked: t('Too many wrong attempts — this account is locked for 15 minutes.'),
    'bad-totp': t('Wrong code.'),
    expired: t('This sign-in expired. Start again.'),
    'account-exists': t('An account already exists on this server. Sign in with its email and password.'),
  }[e]
}

const STYLE = `
:root{color-scheme:light dark;--a:#1a8cff}
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif;background:#f2f3f5;color:#1d1d1f}
.card{width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid #e3e3ea;border-radius:18px;padding:28px;box-sizing:border-box;text-align:center}
img{width:64px;height:64px}h1{font-size:20px;margin:12px 0 4px}p{color:#6b6b78;font-size:13.5px;margin:0 0 18px}
label{display:block;text-align:left;font-size:12.5px;color:#6b6b78;margin:12px 0 4px}
input{width:100%;box-sizing:border-box;height:44px;border:1px solid #e3e3ea;border-radius:10px;font-size:16px;padding:0 12px;background:#fff;color:inherit}
input:focus{outline:2px solid var(--a);outline-offset:-1px;border-color:var(--a)}
input.code{font-size:20px;letter-spacing:3px;text-align:center;text-transform:uppercase}
input.num{font-size:24px;letter-spacing:6px;text-align:center}
button{margin-top:16px;cursor:pointer;width:100%;height:44px;border:0;border-radius:10px;background:var(--a);color:#fff;font-size:15px;font-weight:600}
a.alt{display:block;margin-top:16px;font-size:13px;color:var(--a);text-decoration:none}
.err{color:#d93a3a;font-size:13px;margin-top:12px}
code{font-size:12.5px}
@media (prefers-color-scheme:dark){body{background:#111113;color:#ececf2}.card{background:#1c1c1e!important;border-color:#2c2c30!important}input{background:#111113;color:#ececf2;border-color:#2c2c30!important}}
`

/** Sign-in, second step, first-time account creation, or the pairing-code form, in the browser's language. */
export function authPage(lang: Lang, v: AuthView): string {
  return withLang(lang, () => {
    const err = errorText(v.error)
    let title = ''
    let body = ''
    let action = '/api/login'
    let alt = ''
    if (v.view === 'login') {
      action = '/api/auth/login'
      title = t('Sign in')
      body = `<p>${t('Use the email and password of your Octopus Mail account.')}</p>
<label for="e">${t('Email')}</label><input id="e" name="email" type="email" autocomplete="username" required autofocus value="${esc(v.email || '')}">
<label for="p">${t('Password')}</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">${t('Sign in')}</button>`
      if (v.allowPairing) alt = `<a class="alt" href="/?pair=1">${t('Use a pairing code instead')}</a>`
    } else if (v.view === 'totp') {
      action = '/api/auth/totp'
      title = t('Two-step verification')
      body = `<p>${t('Enter the 6-digit code from your authenticator app, or a recovery code.')}</p>
<input type="hidden" name="ticket" value="${esc(v.ticket)}">
<input class="num" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" required autofocus maxlength="12">
<button type="submit">${t('Verify')}</button>`
      alt = `<a class="alt" href="/">${t('Back to sign in')}</a>`
    } else if (v.view === 'setup') {
      action = '/api/auth/setup'
      title = t('Create your account')
      body = `<p>${t('Choose the email and password you will use to sign in on every device.')}<br>${t('Pairing code from the server:')} <code>octo server pair</code></p>
<label for="c">${t('Pairing code')}</label><input class="code" id="c" name="code" placeholder="XXXX-XXXX" autocomplete="one-time-code" required autofocus maxlength="9">
<label for="e">${t('Email')}</label><input id="e" name="email" type="email" autocomplete="username" required value="${esc(v.email || '')}">
<label for="p">${t('Password')}</label><input id="p" name="password" type="password" autocomplete="new-password" required minlength="10">
<label for="p2">${t('Repeat the password')}</label><input id="p2" name="password2" type="password" autocomplete="new-password" required minlength="10">
<button type="submit">${t('Create account')}</button>`
    } else {
      title = 'Octopus Mail'
      body = `<p>${t('Enter the pairing code from your home server.')}<br>${t('New code:')} <code>octo server pair</code><br>${t('or ask from a paired device')}</p>
<input class="code" name="code" placeholder="XXXX-XXXX" autocomplete="one-time-code" autofocus required maxlength="9">
<button type="submit">${t('Connect')}</button>`
      if (v.hasOwner) alt = `<a class="alt" href="/">${t('Back to sign in')}</a>`
    }
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t('Octopus Mail — sign in')}</title>
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-192.png"><meta name="theme-color" content="#1c1c1e">
<style>${STYLE}</style></head><body><form class="card" method="post" action="${action}" onsubmit="var b=this.querySelector('button[type=submit]');if(b){if(b.disabled)return false;b.disabled=true;b.style.opacity='.6';b.textContent='…'}">
<img src="/logo.svg" alt="" onerror="this.remove()"><h1>${title}</h1>
${body}${err ? `<div class="err" role="alert">${err}</div>` : ''}${alt}
</form></body></html>`
  })
}

/** The pairing-code form (kept for `?pair=1` and for servers without an account yet). */
export function loginPage(lang: Lang, error?: LoginError): string {
  return authPage(lang, { view: 'pair', error })
}
