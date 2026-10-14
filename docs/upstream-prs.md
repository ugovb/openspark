# Pull requests prepared for CFGPeter/octopus-mail

Five independent branches, each based on upstream `main` (10696f3). Branch names: `pr/<name>` in `ugovb/openspark`.
Open them from your own fork (push the branches there, then "Compare & pull request" against `CFGPeter/octopus-mail:main`).

```bash
git clone https://github.com/ugovb/openspark && cd openspark
git remote add fork https://github.com/<you>/octopus-mail      # your fork, created with the Fork button
for b in macos-app proxy-synology infomaniak french-spanish-sorting openai-compatible-ai; do
  git fetch origin pr/$b && git push fork origin/pr/$b:refs/heads/$b
done
```

Tip: open an issue first ("Would you take PRs for macOS / Infomaniak / …?") and link the PRs in it.
Not proposed upstream: the Spark-like theme (kept only in the fork).

---

## 1. macos-app: "macOS (Apple Silicon) support"

Adds a macOS arm64 build so the app runs natively on M-series Macs.

- `electron-builder` `mac` target (dmg + zip, arm64, ad-hoc signed because arm64 binaries need a signature), `npm run dist:mac`
- macOS menu bar built from roles (Cmd+C/V/Q/W work; it was `null` everywhere), `activate` reopens the window from the Dock, window stays alive after the last window closes
- monochrome template tray icon (`trayTemplate*.png`), hidden-inset title bar with a draggable strip
- `octo` CLI wrapper inside the app bundle (`Contents/Resources/octo`; a script in `Contents/MacOS` breaks code signing)
- `.github/workflows/release.yml`: builds on `macos-14`, runs `octo help` and a signature check, uploads the DMG; attaches it to the release on `v*` tags or a manual run with a tag
- Polish translation for the new "View" menu

Tested: typecheck, `i18n:check`, `electron-vite build`; the workflow ran green on a macos-14 runner. Not tested by me on a physical Mac beyond a user confirming the app opens.

## 2. proxy-synology: "Run the home server behind a reverse proxy (Synology)"

- `OCTO_TRUST_PROXY=1`: use the left-most `X-Forwarded-For` as client address (otherwise every client looks like the proxy and the "10 failed codes" lockout hits everybody) and add `Secure` to the cookie when `X-Forwarded-Proto: https`. Off by default.
- CSP `connect-src` allows `wss:` (live updates over HTTPS), Apple home-screen meta tags
- `deploy/docker-compose.synology.yml`, `docs/synology.md` (DSM reverse proxy, Let's Encrypt, iPhone, pairing)
- `.github/workflows/docker.yml`: multi-arch image to `ghcr.io/<repo>` (the compose file points at `ghcr.io/cfgpeter/octopus-mail`; adjust if you publish elsewhere)

Test: `tests/proxy.test.ts` (header honoured only with the env var set).

## 3. infomaniak: "Add Infomaniak mail preset"

IMAP/SMTP `mail.infomaniak.com` (993 / 465 SSL), domains `ik.me`, `ikmail.com`, `etik.com`, `infomaniak.ch`, detection of custom domains by MX (`*.infomaniak.ch|com`), hint about device passwords with two-step verification, quick button in the account wizard, Polish hint. Test: `tests/infomaniak.test.ts`.

## 4. french-spanish-sorting: "Smart Inbox: French and Spanish senders"

Adds French and Spanish words to the sender heuristics (`ne-pas-repondre`, `facture`, `commande`, `no-responder`, `pedidos`, `promotions`, `novedades`, `ofertas`, …) and French/Spanish/Swiss services to the notification domains. Personal mail providers (orange.fr, sfr.fr, free.fr, laposte.net) are deliberately left out. Test: `tests/categorize-fr-es.test.ts`, including people who must stay "People".

## 5. openai-compatible-ai: "AI: OpenAI-compatible provider"

Fourth AI provider next to Ollama / Claude / off: any endpoint with `POST {base}/chat/completions` (Mammouth, OpenRouter, LM Studio, …). Base URL, model and key (stored in the secret store) in Settings → AI; streaming (SSE) and non-streaming; retries without `response_format` if a provider rejects JSON mode; clear errors for 401/403/429. Polish strings included. Test: `tests/openai-provider.test.ts` against a local fake server.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

