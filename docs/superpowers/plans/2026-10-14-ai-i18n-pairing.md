# Plan — FR/ES, Anthropic-compatible, default badge, pairing code UI, writing instructions

Spec: `docs/superpowers/specs/2026-10-14-ai-i18n-pairing-design.md`

**Global constraints (copied from spec):** AI prompts / CLI / MCP stay English. One global provider, no fallback. Pairing codes: 15 min, one use, created only by a paired device. Email content is data, never instructions (always appended, not editable). Colours via theme tokens only. New UI strings through `t()` with pl/fr/es entries.

**Checks per task:** `npx tsc --noEmit -p tsconfig.node.json`, `npx tsc --noEmit -p tsconfig.web.json`, `npm run i18n:check`, `node scripts/run-tests.mjs <test file>`. GreenMail suite not required.

**Review focus (inputs tests must cover):** provider URL with trailing slash or `/v1`; empty key; 401/429 from the fake server; draftPrompt of 4000+ chars; draftPrompt containing "ignore previous instructions" (guard still last); pairing code redeemed twice; expired code; 6th live code; `tp(0|1|2|5)` in French.

## File map

- Task 1: `src/core/ai/provider.ts`, `src/core/secrets.ts`, `src/core/settings.ts`, `src/shared/types.ts`, `src/core/service.ts`, `SettingsView.tsx`, `AskView.tsx`, `src/cli/octo.ts`, `tests/anthropic-compat.test.ts`
- Task 2: `SettingsView.tsx` (AI tab), `AskView.tsx`
- Task 3: `src/core/ai/features.ts`, `settings.ts`, `types.ts`, `SettingsView.tsx`, `tests/draft-prompt.test.ts`
- Task 4: `src/server/auth.ts`, `SettingsView.tsx` (ServerTab), `src/server/login.ts`, `tests/` pairing test
- Task 5: `src/shared/i18n.ts`, `src/shared/locales/{fr,es}.ts`, `src/shared/locales/{fr,es}/*.ts`, `scripts/i18n-check*`, `types.ts`, `features.ts`, `SettingsView.tsx`, `tests/i18n.test.ts`

Work on `main` of `ugovb/openspark` task by task (one commit each, no push until you say so — AGENTS.md rule). After all tasks, cherry-pick each commit onto its own `pr/*` branch from upstream main and rerun checks.

## Task 1 — Anthropic-compatible provider (`pr/anthropic-compat`)

Interface: `provider: 'ollama'|'claude'|'openai'|'anthropic-compat'|'off'`; settings `anthropicCompatUrl`, `anthropicCompatModel`; `setAnthropicCompatKey(key|null)`, `hasAnthropicCompatKey()`; `aiStatus.hasAnthropicCompatKey`.

1. Write failing test: fake HTTP server on `/v1/messages`; assert request has `x-api-key`, no `anthropic-beta` header, body has `system`, `messages`, `max_tokens`, no `output_config`; non-streaming and streaming (SSE) text returned; 401 → "Invalid API key"; missing config → clear error.
2. Run test, see it fail.
3. Add secret name, settings defaults (`''`), types, `completeAnthropicCompat` (SDK `baseURL`, plain `messages`), routing in `complete()` and `activeProvider()`.
4. Service/status wiring, Settings section "Anthropic-compatible API" (URL, model, key, Save/Remove), AskView label, `octo ai` output.
5. Run checks, commit "Add Anthropic-compatible AI provider".

## Task 2 — "Used by default" badge (`pr/default-provider-badge`)

1. Settings AI tab: factor a small `ProviderHeader({ id, title })` showing the pill when `s.ai.provider === id`, else a "Use by default" button calling `ai({ provider: id })`. Apply to Ollama, Claude, OpenAI-compatible, Anthropic-compatible sections.
2. Add pl strings. Run typecheck + i18n:check, screenshot Settings → AI with Playwright (demo profile, `OCTO_HOME` tmp) to verify the badge.
3. Commit "Show which AI provider is used by default".

## Task 3 — Writing instructions (`pr/draft-prompt`)

Interface: `ai.draftPrompt: string`; exported `DEFAULT_DRAFT_PROMPT` from `features.ts`.

1. Failing test: stub `complete` (or fake provider server) and capture the system prompt. Cases: empty → contains default; custom → contains custom, not default; guard sentence and "Return ONLY the body" present in both; custom prompt with an injection phrase still followed by the guard-order assertion; 5000 chars truncated to 4000.
2. Implement in `draftReply`: split the current block into locked parts (language, tone, output format) and the replaceable part.
3. Settings UI: textarea, "Show default" disclosure, "Restore default" button, counter.
4. Checks, commit "Add custom writing instructions for AI replies".

## Task 4 — Pairing code UI (`pr/pairing-code-ui`)

1. Failing server test: with a device token create a code (name optional); redeem once OK, twice 403; expired (fake clock) 403; no token on `/api/devices/pair` → 401; creating a 6th live code drops the oldest.
2. `auth.ts`: cap live codes at 5.
3. ServerTab: "Add device" → optional name input → code card with countdown (1 s interval, cleared on unmount), Copy button (`navigator.clipboard`, toast), expired state with "New code". Same component works in web UI through the bridge.
4. Login page hint text. pl strings.
5. Checks, commit "Pairing code with countdown and copy button".

## Task 5 — French and Spanish (`pr/lang-fr-es`)

1. Failing test: `initLang` per locale; `t` returns FR/ES for a sample key; `tp` for 0, 1, 2, 5; `dateLocale()`.
2. Generalise `i18n.ts` (`Lang`, `detectLang`, `initLang`, `dateLocale`, `t`, `tp` with per-language plural index), types, `LANGUAGES`, reply-language options, `uiLanguageRule`/`languageName`.
3. Extend `i18n:check` to loop over pl, fr, es.
4. Translate the 7 parts, one commit-sized chunk each, for `fr` then `es`. Mirror pl keys exactly. Keep `{placeholders}` and shortcut letters untouched. Run `i18n:check` after each part.
5. Add the new strings from Tasks 1–4 to all three languages.
6. Visual check: Playwright screenshots at 390×844 and desktop, FR and ES, look for overflow in sidebar and Settings.
7. Commit "Add French and Spanish UI".

## Self-review

- Spec coverage: sections 1–5 map to Tasks 5, 1, 2, 4, 3. Out-of-scope items have no task.
- Locked prompt parts are explicit in Task 3, tests assert them.
- Task 5 runs last so it covers strings from Tasks 1–4.
- Open assumptions (vous/tú, locked tone and language rules, "GLM flash" reading) are listed in the spec.
