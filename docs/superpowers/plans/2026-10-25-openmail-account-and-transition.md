# OpenMail central account, code sign-in and octo-to-OpenMail transition: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One OpenMail account that holds all of Ugo's mailboxes and signs in on any device with a short code, no terminal and no `docker exec`, and OpenMail replaces Octopus/`octo` everywhere.

**Architecture:** The account is the existing owner account of the home server (email + password + optional TOTP). That server is the central place, like Spark's cloud but run by the user. Three additions: a setup code that does not need a terminal, a device-approval sign-in (a new device shows a code, a signed-in device approves it), and a first-run screen in the app built around "Sign in to OpenMail". The rename work (PR 2 to 4 of the earlier transition plan) lands first so the new code uses the new names.

**Tech Stack:** Electron 44, React 19, TypeScript, Tailwind v4, `node:sqlite`, `node:test` through `scripts/run-tests.mjs`, Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:$PATH`).

**Spec:** [2026-10-14-ai-i18n-pairing-design.md](../specs/2026-10-14-ai-i18n-pairing-design.md) for the existing pairing model, `/mnt/project-files/openmail/plan-transition-octo-vers-openmail.md` for the rename. Design choices for this plan are in "Decisions" below.

## Decisions (made by me, because Ugo asked me to pick; he can overrule any of them)

| Question | Choice | Why |
|---|---|---|
| Final command | `openmail`; `octo` stays as a deprecated alias until PR 5 | Matches the product name; no existing script breaks |
| Old `octopus-mail://` links | Still read, never written | Costs a few lines, avoids dead links |
| Old profile | Copy, never move; old folder and keychain entry stay until the user deletes them in Settings | A failed migration cannot lose accounts |
| Mascot | Open-envelope illustration matching the new icon, accent blue | Same visual family as the icon |
| "Central account" | The owner account on the user's own server. No OpenMail-run cloud | There is no hosting service; adding one is a separate product |
| Terminal-free setup | Setup code from env `OPENMAIL_SETUP_CODE`, else generated and printed in the container log; valid until the account exists | Container Manager and Portainer show logs without a shell |
| Code sign-in | Device-approval flow modelled on RFC 8628 (device shows `ABCD-EFGH`, a signed-in device approves) | Typing a password on a phone or TV is the pain; approval asks the approver's password so 2FA keeps its value |
| Users | Still one owner per server | Teams are out of scope |

## Global Constraints

- Node 24; run every command with `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- UI text only through `t()` / `tp()`, with `pl`, `fr`, `es` entries; `npm run i18n:check` must pass.
- Colours only through theme tokens in `src/renderer/src/index.css`.
- Tests and demos always use `OPENMAIL_HOME` (before Task A1: `OCTO_HOME`) in a temp folder and `*_SECRETS=memory`. Never touch `~/Library/Application Support/Octopus Mail`.
- No data loss: accounts, mail, drafts, keychain secrets survive every task.
- Old names keep working (env fallback, alias, old folder, old header, old scheme) until PR 5.
- Work on local branches only. No push, no PR, no merge without Ugo's word. One commit per task. Do not commit `package-lock.json` changes that `npm install` produced unless a task changes dependencies.
- Checks per task: `npm run typecheck`, `npm run i18n:check`, `node scripts/run-tests.mjs <name>`, `npx electron-vite build`. The GreenMail suite (`npm run greenmail`, Java 17+) runs at the end of each phase if Java is present.

## Review Focus

Inputs the spec implies but no task would test on its own. Each has a test in the task named in brackets.

1. Setup code used after the owner exists, or reused after success: must be refused (B1, B2).
2. `OPENMAIL_SETUP_CODE` shorter than 8 characters or with spaces: server must ignore it and generate its own, with a log warning (B1).
3. A device code polled after approval, twice: the token is delivered once, the second poll gets "expired" (B3).
4. Approval attempted with no password, a wrong password, or from a device that has no user (paired by code before accounts existed): refused (B3).
5. An expired or unknown user code, 50 wrong guesses from one IP: refused and rate-limited by the existing failure counter (B3).
6. Migration when both `Octopus Mail` and `OpenMail` folders exist, or two processes start together: no overwrite, one winner (C1).
7. `OPENMAIL_*` and `OCTO_*` both set with different values: `OPENMAIL_*` wins (A1).

## File map

- A: new `src/shared/env.ts`; touches ~120 call sites in `src/**` and `tests/**`; `src/cli/octo.ts` becomes `src/cli/openmail.ts`; `scripts/build-cli.mjs`, `bin/`, `resources/mac|linux/`, `deploy/*`.
- B: new `src/server/setup.ts`, `src/server/device-login.ts`; modify `src/server/server.ts`, `src/server/login.ts`, `src/main/backend.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/lib/web-bridge.ts`, `src/renderer/src/App.tsx`, new `src/renderer/src/views/SignInScreen.tsx`, `src/renderer/src/views/SettingsView.tsx`, `src/renderer/src/components/Sidebar.tsx`, `deploy/docker-compose*.yml`, `docs/synology.md`, `README.md`.
- C: `src/core/paths.ts`, `src/core/secrets.ts`, new `src/core/migrate.ts`, Settings row.
- D: `window.octo` to `window.openmail`, `illustrations.tsx`, `index.css`, `scripts/demo.mjs`.
- E: `README.md`, `AGENTS.md`, `package.json`, shortcut handling.

---

## Phase 0: Baseline

### Task 0: Branch and green baseline

**Files:** none.

- [ ] **Step 1:** On branch `om/work` (cut from PR 1's branch `claude/project-thread-p85gvl`), run `npm run typecheck && npm run i18n:check && node scripts/run-tests.mjs home-server-unit`. Expected: all pass.
- [ ] **Step 2:** Run `node scripts/run-tests.mjs users` and `account`. Expected: pass (they cover the owner account that Phase B extends).

---

## Phase A: Names (PR 2 of the transition)

### Task A1: Central `env()` with OPENMAIL first, OCTO as fallback

**Files:** Create `src/shared/env.ts`, `tests/env.test.ts`.

**Interfaces:** Produces `env(name: string): string | undefined` (reads `process.env['OPENMAIL_' + name]`, else `process.env['OCTO_' + name]`; an empty string counts as unset) and `envFlag(name: string): boolean` (true for `1`, `true`, `yes`).

- [ ] **Step 1:** Write `tests/env.test.ts`: `OPENMAIL_HOME` wins over `OCTO_HOME` when both are set; only `OCTO_HOME` set returns it; empty `OPENMAIL_HOME` falls through; `envFlag('QUIET')` is true for `1` and `true`, false for `0` and unset.
- [ ] **Step 2:** `node scripts/run-tests.mjs env` fails (module missing).
- [ ] **Step 3:** Implement both functions in `src/shared/env.ts`.
- [ ] **Step 4:** Test passes. Commit `Add env() helper reading OPENMAIL_ then OCTO_`.

### Task A2: Replace every `process.env.OCTO_*` read

**Files:** Modify all files returned by `grep -rn "OCTO_" src tests scripts`.

**Interfaces:** Consumes `env()` from A1. Writes (`process.env.OCTO_QUIET = …`) become `process.env.OPENMAIL_QUIET = …`.

- [ ] **Step 1:** Add a guard test `tests/no-legacy-env.test.ts` that scans `src/**/*.ts(x)` and fails on any `process.env.OCTO_` or `process.env['OCTO_` outside `src/shared/env.ts`. Run it: fails and lists the sites.
- [ ] **Step 2:** Replace reads with `env('NAME')` / `envFlag('NAME')` and writes with `OPENMAIL_`, in one pass per directory (`src/core`, `src/server`, `src/cli`, `src/main`, `src/renderer`, `scripts`, `tests`). Test files set `OPENMAIL_HOME` and `OPENMAIL_SECRETS`.
- [ ] **Step 3:** Run the guard test, then `typecheck`, `home-server-unit`, `users`, `account`, `pairing`, `server`. All pass.
- [ ] **Step 4:** Commit `Read configuration through env() everywhere`.

### Task A3: `openmail` command, `octo` as deprecated alias

**Files:** Rename `src/cli/octo.ts` to `src/cli/openmail.ts`; modify `scripts/build-cli.mjs`, `package.json` (`bin`, `build:cli`), `bin/`, `resources/mac/`, `resources/linux/`, `src/main/index.ts` (the `claude mcp add` string), `src/shared/locales/*/cli.ts`; create `bin/openmail`, `bin/openmail.cmd`, `resources/mac/openmail`, `resources/linux/openmail`; keep `bin/octo*` as thin wrappers.

**Interfaces:** Produces `out/cli/openmail.js`. Produces `deprecatedAlias(invokedAs: string): string | null` in `src/cli/openmail.ts` returning the one-line stderr notice when the binary name is `octo`.

- [ ] **Step 1:** Test `tests/cli-alias.test.ts`: `deprecatedAlias('octo')` returns a string containing `openmail`; `deprecatedAlias('openmail')` is null; spawning the built CLI with `--help` under both names prints the same usage on stdout, and the notice only for `octo`, only on stderr.
- [ ] **Step 2:** Run, see it fail.
- [ ] **Step 3:** Rename the file, update `build-cli.mjs` to emit `openmail.js` and an `octo.js` stub that requires it, add launchers, update help text and the MCP command shown in Settings to `openmail mcp`. Docs examples in help use `openmail`.
- [ ] **Step 4:** `node scripts/build-cli.mjs && node out/cli/openmail.js --help && node out/cli/octo.js --help` both work; test passes.
- [ ] **Step 5:** Commit `CLI: openmail command, octo kept as deprecated alias`.

### Task A4: Docker, systemd installer and docs use the new names

**Files:** `deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/docker-compose.synology.yml`, `deploy/install.sh`, `docs/synology.md`, `README.md`.

- [ ] **Step 1:** Dockerfile installs both `/usr/local/bin/openmail` and `/usr/local/bin/octo` (alias), sets `OPENMAIL_HOME=/data OPENMAIL_SECRETS=server`, container and service names `openmail`. The old `octopus-data` volume name stays so existing data is found.
- [ ] **Step 2:** `install.sh` installs `openmail` and an `octo` symlink; service name `openmail`; prints the command to stop the old `octopus-mail` service if present.
- [ ] **Step 3:** Verify: `docker build -f deploy/Dockerfile .` if Docker is available, else `bash -n deploy/install.sh` and a grep that no file still tells users to run `octo`.
- [ ] **Step 4:** Commit `Deploy files and docs: openmail command and service name`.

---

## Phase B: Central account and code sign-in (the headline feature)

### Task B1: Terminal-free setup code

**Files:** Create `src/server/setup.ts`, `tests/setup-code.test.ts`.

**Interfaces:** Produces `getSetupCode(): string | null` (null when an owner exists), `redeemSetupCode(input: string): boolean` (timing-safe, ignores case, spaces and hyphens, false when an owner exists). Source order: `env('SETUP_CODE')` if it has at least 8 characters of `[A-Za-z0-9-]`, else a code generated once and stored under KV key `server.setupCode`, format `XXXX-XXXX` from the same alphabet as pairing codes. Consumes `hasOwner()` from `users.ts`.

- [ ] **Step 1:** Tests: generated code is stable across two calls; env code is used when valid; env code of 7 characters or with spaces is ignored; `redeemSetupCode` accepts the code in lower case and without the hyphen; returns false for a wrong code; after `createOwner`, `getSetupCode()` is null and `redeemSetupCode(code)` is false.
- [ ] **Step 2:** Run, fail.
- [ ] **Step 3:** Implement. Log a warning when the env code is rejected.
- [ ] **Step 4:** Pass. Commit `Server: setup code that needs no terminal`.

### Task B2: Account creation with the setup code; `/api/info` and startup banner

**Files:** Modify `src/server/server.ts` (`/api/auth/setup`, `/api/info`), `src/cli/openmail.ts` (`serve` banner), `src/shared/types.ts` (`ServerInfo`), `tests/account.test.ts`.

**Interfaces:** Consumes `redeemSetupCode`. `/api/auth/setup` accepts the setup code, or (compat) a pairing code. `/api/info` adds `setup: boolean` (true while no owner exists). `serve` prints the setup code while no owner exists and nothing about pairing.

- [ ] **Step 1:** Extend `tests/account.test.ts`: create the owner with the setup code (200 and a token); second attempt with the same code gets 409/403 and creates nothing; wrong code 403 and counts as a failure; pairing code still works; `/api/info` reports `setup: true` before and `false` after.
- [ ] **Step 2:** Run, fail. Implement. Run, pass.
- [ ] **Step 3:** Manual check: start `openmail serve` against a temp `OPENMAIL_HOME`; the banner shows the code and the address.
- [ ] **Step 4:** Commit `Create the account with the setup code`.

### Task B3: Device approval backend

**Files:** Create `src/server/device-login.ts`, `tests/device-login.test.ts`; modify `src/server/server.ts`.

**Interfaces:**
- Produces `startDeviceLogin(name: string, ip: string | null): { userCode: string; deviceCode: string; expires: number; interval: number }` (userCode `XXXX-XXXX`, TTL 10 min, `interval` 2 s, at most 20 live requests, oldest dropped; only SHA-256 hashes stored under KV `server.deviceLogins`).
- `approveDeviceLogin(userCode: string, userId: number): boolean`.
- `denyDeviceLogin(userCode: string): boolean`.
- `pollDeviceLogin(deviceCode: string, ip: string | null): { status: 'pending' } | { status: 'approved'; token: string; device: PublicDevice } | { status: 'denied' | 'expired' }` (approval consumed on first successful poll, which calls `issueDevice(name, ip, userId, 'password')`).
- HTTP: `POST /api/auth/device/start` (public, needs an owner, rate limited), `POST /api/auth/device/poll` (public, body `{deviceCode}`), `POST /api/auth/device/approve` and `/deny` (authenticated device that has a `userId`; body `{userCode, password, code?}`; re-checks the password and the TOTP code through the same `confirm` helper as account changes).

- [ ] **Step 1:** Tests (use the fake clock pattern from `tests/pairing.test.ts`): full path start, approve, poll returns a working token; second poll after success returns `expired`; poll before approval returns `pending`; expired after 10 minutes; wrong password on approve gives 401 and the request stays pending; approver without `userId` gets 403; unknown user code gives 404; deny makes the next poll `denied`; 21st live request drops the oldest; `start` before any owner exists gives 409; 11 wrong approvals from one IP trip `tooManyFailures`.
- [ ] **Step 2:** Run, fail.
- [ ] **Step 3:** Implement module and routes. Approve/deny go through the cookie CSRF header check already in the authenticated section.
- [ ] **Step 4:** Pass. Commit `Server: sign in a device with a code approved from another device`.

### Task B4: Web sign-in page (setup page and "sign in with a code")

**Files:** Modify `src/server/login.ts`, `src/server/server.ts` (render), `tests/server.test.ts`, locales `pl/fr/es` for the page strings.

**Interfaces:** `AuthView` gains `{ view: 'code'; userCode: string; deviceCode: string }`. The setup view asks for "Setup code" with the hint "Shown in the server log, or the OPENMAIL_SETUP_CODE you set". The login view gets a link "Sign in with a code from another device" that starts the flow, shows the big `XXXX-XXXX`, polls `/api/auth/device/poll` every 2 s with a small inline script, and on `approved` follows the sign-in cookie route.

- [ ] **Step 1:** Test: GET `/` with no owner renders the setup form with the new label and no mention of "pairing code"; with an owner, the login page contains the code link; POST to the start route from the page returns HTML with a code in the expected format.
- [ ] **Step 2:** Implement; the inline script is under the existing CSP rules (check `PUBLIC_FILES`/headers; add a nonce if the CSP forbids inline script).
- [ ] **Step 3:** Pass; load the page in the Browser pane against a temp server and screenshot light and dark.
- [ ] **Step 4:** Commit `Web sign-in: setup code and sign in with a code`.

### Task B5: Desktop client plumbing for code sign-in

**Files:** `src/main/backend.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/lib/web-bridge.ts`, `src/renderer/src/lib/api.d.ts` typings, `tests/home-server-unit.test.ts`.

**Interfaces:** `RemoteBackend.startCodeLogin(url, deviceName): Promise<{ userCode: string; deviceCode: string; expires: number }>`, `RemoteBackend.pollCodeLogin(url, deviceCode): Promise<{ status: 'pending' | 'denied' | 'expired' } | { status: 'approved'; cfg: RemoteConfig }>`. IPC `server-code-start`, `server-code-poll`, `server-approve` (`{userCode, password, code?}`), `server-create-account` (`{url, email, password, setupCode}` for first-run creation, which then signs in). On `approved` the main process stores the config and restarts into remote mode like `server-connect` does.

- [ ] **Step 1:** Unit tests against a real `runServer` (pattern from `server.test.ts`): `startCodeLogin` then approve through the API then `pollCodeLogin` yields a config whose token works on `/api/me`; `server-create-account` path creates the owner with the setup code.
- [ ] **Step 2:** Implement; run tests.
- [ ] **Step 3:** Commit `App: client calls for code sign-in and account creation`.

### Task B6: First-run "Sign in to OpenMail" screen

**Files:** Create `src/renderer/src/views/SignInScreen.tsx`; modify `src/renderer/src/App.tsx:196` (the `!accounts.length` gate); locales.

**Interfaces:** `SignInScreen({ onLocal }: { onLocal: () => void })` with three paths on one screen: (1) server address then email and password (and TOTP step), (2) "Sign in with a code" showing the code and waiting, (3) "Create your account" when `probe` says `setup: true`, asking for the setup code, email, password twice, then offering the two-step verification later. A quiet link "Use only on this computer" calls `onLocal` and shows the existing `AccountWizard welcome`. The last server address is remembered in `localStorage` (try/catch).

- [ ] **Step 1:** Component test is not available (no React test runner), so write a Playwright script `scripts/shots-signin.mjs` run against a temp server plus `npm run dev`: asserts the three paths render, the code path shows an `XXXX-XXXX` string, creating an account moves to the mail view.
- [ ] **Step 2:** Implement with theme tokens and `t()`; phone layout via `useNarrow()`.
- [ ] **Step 3:** Run the script; screenshot light, dark, narrow. Typecheck, i18n:check.
- [ ] **Step 4:** Commit `First run: sign in to or create your OpenMail account`.

### Task B7: Approve a device, account chip, and "Add a mail account" check

**Files:** `src/renderer/src/views/SettingsView.tsx` (Home server tab), `AccountSection.tsx`, `src/renderer/src/components/Sidebar.tsx`, locales.

**Interfaces:** Settings → Home server → My account gets "Approve a device": field for the code, password (and TOTP if on), Approve and Deny buttons, calls `server-approve`. The sidebar footer shows the OpenMail account email with "Sign out" when `backend.kind === 'remote'`.

- [ ] **Step 1:** Extend `scripts/shots-signin.mjs`: sign in on browser A, start a code on browser B, approve in A's Settings, B reaches the mail view.
- [ ] **Step 2:** Implement. Also verify by hand on the server-backed app that "Add account" works (IMAP with an app password against GreenMail) and the account appears for the second device; note any gap as a new task in this plan.
- [ ] **Step 3:** Commit `Approve devices from Settings; show the OpenMail account in the sidebar`.

### Task B8: Compose files, deep link, docs

**Files:** `deploy/docker-compose.yml`, `deploy/docker-compose.synology.yml`, `src/main/index.ts` (handle `openmail://connect?url=…`), `docs/synology.md`, `README.md`.

- [ ] **Step 1:** Compose files set `OPENMAIL_SETUP_CODE: "change-me-please"` as a commented example and document `docker logs openmail` and Container Manager's Log tab. Remove "exec … pair" from the first-run path.
- [ ] **Step 2:** Deep link `openmail://connect?url=http://nas.local:8787` pre-fills the sign-in screen (test the parser as a pure function `parseConnectLink`, in `tests/connect-link.test.ts`: accepts http/https URLs only, rejects `javascript:` and missing url).
- [ ] **Step 3:** The server login page shows a QR-free "open in the app" link with that scheme.
- [ ] **Step 4:** README and `docs/synology.md` describe: start container, open address, enter setup code, create account, install app, sign in with email or code. Keep the terminal recovery commands in a "Recovery" section.
- [ ] **Step 5:** Commit `Docs and deploy: set up without a terminal`.

---

## Phase C: Data migration (PR 3 of the transition)

### Task C1: Copy the old profile on first launch

**Files:** Create `src/core/migrate.ts`, `tests/migrate.test.ts`; modify `src/core/paths.ts`, `src/core/boot.ts`.

**Interfaces:** `legacyDataDir(): string`, `migrateLegacyProfile(): { migrated: boolean; from?: string }`. New folder `OpenMail`, database `openmail.db`. Copy goes to `OpenMail.tmp-<pid>` then an atomic rename; a lock file (`O_EXCL`) serialises app, CLI and server.

- [ ] **Step 1:** Tests on temp dirs: old folder with db, attachments and a settings file ends up in the new folder, old folder byte-identical; second call returns `migrated: false`; both folders existing leaves the new one untouched; two concurrent calls produce one copy and no error; `OPENMAIL_HOME` set explicitly skips migration.
- [ ] **Step 2:** Run, fail. Implement. Pass.
- [ ] **Step 3:** Call it in `initCore()` before the database opens. Commit `Migrate legacy Octopus Mail profile to OpenMail (copy)`.

### Task C2: Keychain and server secrets

**Files:** `src/core/secrets.ts`, `tests/migrate-secrets.test.ts`.

**Interfaces:** Reads service `OpenMail` first, else `Octopus Mail`; on a hit from the old service writes it to the new one, rereads, and leaves the old entry alone.

- [ ] **Step 1:** Tests with the in-memory backend: old-only secret is readable and appears under the new name; write-back failure still returns the value; old entry never deleted by migration.
- [ ] **Step 2:** Implement, pass, commit `Secrets: read the old keychain entry and copy it to OpenMail`.

### Task C3: Settings row and Docker/systemd note

**Files:** `SettingsView.tsx` (General tab), locales, `docs/synology.md`, `deploy/install.sh`.

- [ ] **Step 1:** "Old profile kept at …" with a "Delete old profile" button that asks for confirmation and removes only the old data folder and old keychain entries after verifying the new profile opens. Shown only when the old folder exists.
- [ ] **Step 2:** Docs: the `octopus-data` volume keeps working because the container already uses `/data`; command to stop and disable the old `octopus-mail` service.
- [ ] **Step 3:** Commit `Settings: keep or delete the old profile`.

---

## Phase D: Internal names and visuals (PR 4 of the transition)

### Task D1: `window.openmail`

**Files:** `src/preload/index.ts`, `src/renderer/src/lib/api.d.ts`, `web-bridge.ts`, 46 renderer usages, `__OCTO_WEB__`.

- [ ] **Step 1:** Guard test `tests/no-window-octo.test.ts` fails on `window.octo` outside a single alias line.
- [ ] **Step 2:** Rename, keep `window.octo = window.openmail` for one version, migrate `localStorage` keys on read (`octo.*` to `openmail.*`, try/catch).
- [ ] **Step 3:** Typecheck, tests, commit `Rename the renderer bridge to window.openmail`.

### Task D2: Envelope illustration and blue accent

**Files:** `src/renderer/src/components/illustrations.tsx`, `src/renderer/src/index.css`.

- [ ] **Step 1:** Replace the octopus in empty states and the welcome art with an open-envelope drawing using tokens. Accent changes to the blue of the icon; check contrast of `text-accent` on `surface` is at least 4.5:1 in light and dark.
- [ ] **Step 2:** Screenshot Inbox zero, empty search, welcome, in both themes.
- [ ] **Step 3:** Commit `New empty-state art and blue accent`.

### Task D3: Captures, header, Message-ID domain

**Files:** `scripts/demo.mjs`, `docs/screenshots/*`, `src/core/send.ts`.

- [ ] **Step 1:** New messages use `@openmail.local` in Message-IDs; both domains are recognised when reading. Test in `tests/send-again.test.ts`.
- [ ] **Step 2:** Rebuild README captures with `node scripts/demo.mjs shots`. Commit `Captures and Message-ID domain`.

---

## Phase E: Review follow-ups

### Task E1: macOS docs and fork links

**Files:** `AGENTS.md` (still describes Windows and Linux only, in Polish), `README.md`, `package.json`.

- [ ] **Step 1:** Add macOS arm64 to AGENTS.md and the commands section (`npm run dev` needs Electron installed by hand when npm blocks install scripts: `node node_modules/electron/install.js`). Point `homepage` and `repository` at `ugovb/openspark` (check they are not still upstream).
- [ ] **Step 2:** Commit `Docs: macOS and fork links`.

### Task E2: Shortcuts and swipes

**Files:** `src/renderer/src/lib/` shortcut handler (find with `grep -rn "case 'e'"`), `ThreadList.tsx`, `lib/swipe.ts`.

- [ ] **Step 1:** Make `d` mean delete/trash and keep `e` for archive/Done, with a shortcut for the Ask view; update the shortcut sheet and locales.
- [ ] **Step 2:** Check swipes on a phone-width emulated page against the demo profile; list in the PR text what is missing before a Spark-style home screen is worth building.
- [ ] **Step 3:** Commit `Shortcuts: separate delete from archive`.

### Task E3: Final verification

- [ ] **Step 1:** `typecheck`, `i18n:check`, full `node scripts/run-tests.mjs` (and GreenMail if Java is available), `npx electron-vite build`, `npm run dist` only if Ugo asks.
- [ ] **Step 2:** Run the app (`npm run dev`) against a temp `OPENMAIL_HOME` and a local `openmail serve`: create the account with the setup code from the log, add a GreenMail IMAP account, sign in a second client with a code, confirm both see the mailbox.
- [ ] **Step 3:** Report the commits per branch to Ugo and ask before any push or PR.

## Out of scope (backlog)

Team threads and comments, meeting notes, natural-language AI rules, Todoist/Notion integrations, recurring event creation, a Spark-style home screen, a hosted OpenMail cloud, several users on one server, splitting the 70 KB view files, PR 5 cleanup of old names.

## Self-review notes

- Coverage: transition PR 2 to 4 are Phase A, C, D; PR 5 stays in backlog on purpose. Ugo's three asks (central account, code login instead of Docker terminal, Spark-like sign-in) are B1 to B8. Earlier review items (macOS docs, fork links, `e`/`d`, swipes) are E.
- Types used across tasks: `redeemSetupCode`, `startDeviceLogin`, `pollDeviceLogin`, `approveDeviceLogin`, `denyDeviceLogin`, `startCodeLogin`, `pollCodeLogin`, `parseConnectLink`, `env`, `envFlag`, `migrateLegacyProfile` are defined once and referenced by the same names.
- Risk: B6 and B7 depend on a real browser or Electron run for proof; the plan therefore pairs them with a Playwright script instead of unit tests.
