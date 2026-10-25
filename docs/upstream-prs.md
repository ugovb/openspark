# Pull requests prepared for ugovb/openspark

Five independent branches, each based on upstream `main` (10696f3). Branch names: `pr/<name>` in `ugovb/openspark`.
Open them from your own fork (push the branches there, then "Compare & pull request" against `ugovb/openspark:main`).

```bash
git clone https://github.com/ugovb/openspark && cd openspark
git remote add fork https://github.com/<you>/openmail      # your fork, created with the Fork button
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
- `.github/workflows/docker.yml`: multi-arch image to `ghcr.io/<repo>` (the compose file points at `ghcr.io/cfgpeter/openmail`; adjust if you publish elsewhere)

Test: `tests/proxy.test.ts` (header honoured only with the env var set).

## 3. infomaniak: "Add Infomaniak mail preset"

IMAP/SMTP `mail.infomaniak.com` (993 / 465 SSL), domains `ik.me`, `ikmail.com`, `etik.com`, `infomaniak.ch`, detection of custom domains by MX (`*.infomaniak.ch|com`), hint about device passwords with two-step verification, quick button in the account wizard, Polish hint. Test: `tests/infomaniak.test.ts`.

## 4. french-spanish-sorting: "Smart Inbox: French and Spanish senders"

Adds French and Spanish words to the sender heuristics (`ne-pas-repondre`, `facture`, `commande`, `no-responder`, `pedidos`, `promotions`, `novedades`, `ofertas`, …) and French/Spanish/Swiss services to the notification domains. Personal mail providers (orange.fr, sfr.fr, free.fr, laposte.net) are deliberately left out. Test: `tests/categorize-fr-es.test.ts`, including people who must stay "People".

## 5. openai-compatible-ai: "AI: OpenAI-compatible provider"

Fourth AI provider next to Ollama / Claude / off: any endpoint with `POST {base}/chat/completions` (Mammouth, OpenRouter, LM Studio, …). Base URL, model and key (stored in the secret store) in Settings → AI; streaming (SSE) and non-streaming; retries without `response_format` if a provider rejects JSON mode; clear errors for 401/403/429. Polish strings included. Test: `tests/openai-provider.test.ts` against a local fake server.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

# Second batch

Open the first batch first. Branches below are on `ugovb/openmail`. Order: `draft-prompt`, `pairing-code-ui`, `lang-fr-es`, then `anthropic-compat` (needs `openai-compatible-ai` merged; or the PR shows both commits), then `default-provider-badge` (needs `anthropic-compat`).

## `draft-prompt` — Custom writing instructions for AI replies
Adds Settings → AI → "Writing instructions". Empty = short built-in default prompt. The text replaces only the role/style part of the reply-draft prompt. The rule that email content is data, the language and tone rules and the "return only the body" line are always added. 4000 character cap, "Show default" and "Restore default". Summaries, categorisation, rewrite and Ask keep their fixed prompts. Test: `node scripts/run-tests.mjs draft-prompt` (fake Ollama server, no mail server).

## `pairing-code-ui` — Pairing code with countdown, copy button, optional device name
"Add device" now asks for an optional device name, then shows the code with an mm:ss countdown and a Copy button, and an expired state with "New code". At most 5 live codes (oldest dropped). The sign-in page hints that a paired device can create a code. No new endpoint. Test: `node scripts/run-tests.mjs pairing` (redeem once, twice, expired, no token → 401, 6th code).

## `lang-fr-es` — French and Spanish UI
Language setting becomes auto / English / Polski / Français / Español. `i18n.ts` supports four languages with per-language plural rules (French treats 0 as singular). Full French and Spanish dictionaries mirroring the Polish keys; `i18n:check` verifies pl, fr and es. AI prompts, CLI and MCP messages stay English; the "reply language" setting gains French and Spanish. Translations were written by an AI and need a native read. Test: `node scripts/run-tests.mjs i18n`.

## `anthropic-compat` — Anthropic-compatible AI provider
New provider with base URL, model and its own stored key, for services that expose the Anthropic Messages API under their own address. It sends no Anthropic-only options (betas, effort, fallbacks), which third-party servers reject. Based on `openai-compatible-ai`. Test: `node scripts/run-tests.mjs anthropic-compat`.

## `default-provider-badge` — Show which AI provider is used by default
Each provider section in Settings → AI shows a "Used by default" pill when active, or a "Use by default" button. Based on `anthropic-compat`.

## Fork only (not for upstream)
`iPhone web app: keep content out of the status bar...` fixes the translucent status bar overlap introduced by this fork's home-screen meta tags.
