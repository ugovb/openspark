# Spec — FR/ES, Anthropic-compatible, default AI badge, temp pairing code, drafting prompt

Date: 2026-10-14. Status: awaiting approval. One PR branch per topic (see end).

## Decisions (from the Q&A)

| # | Decision |
|---|----------|
| 1 | Full UI translation to French and Spanish. Language setting becomes auto / EN / PL / FR / ES. |
| 2 | AI prompts, CLI and MCP messages stay English. Only the reply language of the AI follows `replyLanguage`. |
| 3 | I write the translations. I also keep the default AI prompts short and explicit so a small model (GLM flash class) follows them. |
| 4 | One new provider `anthropic-compat` (base URL + model + key). Official `claude` provider unchanged. |
| 5 | One global provider. Settings → AI shows an "Used by default" badge on the active one. No per-feature override. |
| 6 | Provider failure or missing config = clear error. No silent fallback. |
| 7 | Pairing code: show code with countdown and Copy button. Only an already paired device can create one. Optional device name. One-time use. |
| 8 | New setting "Writing instructions". Empty = built-in default. One prompt, used for reply drafts only. Summaries and categorisation keep fixed prompts. |
| 9 | Email content is data, never instructions. This guard is always appended and cannot be edited. |

## Assumptions to check (say so if wrong)

- French UI uses "vous". Spanish UI uses neutral "tú" imperative (Archivar, Responder).
- "Improve briefly for GLM flash" = the built-in drafting prompt is rewritten short with numbered rules. Not a model-specific code path.
- Output-format line ("return only the body") and the language and tone rules stay locked next to the guard, because the app inserts the result straight into the editor. The user prompt replaces the rest (role, style, greeting, length).
- Pairing already exists in Settings → Home server → Devices ("Add device"). It only shows the code once, with an expiry time. This work extends it. No new server endpoint.

## 1. Languages

- `Lang = 'en'|'pl'|'fr'|'es'`; `LangSetting = 'auto' | Lang`; `LANGUAGES` gets Français, Español.
- `detectLang(locale)`: `fr*` → fr, `es*` → es, `pl*` → pl, else en. `OCTO_LANG` accepts all four.
- `dateLocale()`: fr → fr-FR, es → es-ES.
- Dictionaries `src/shared/locales/{fr,es}.ts` + folders `fr/`, `es/` mirroring `pl/` (same 7 parts, same keys).
- Plurals: `plurals[one]` stays `[one, few, many]`. FR/ES use index 0 for the singular, 1 and 2 for the rest. French treats 0 and 1 as singular. `tp()` picks the index per language.
- `types.ts` `AppSettings.language` and `replyLanguage` gain `fr`/`es`. `replyLanguage` options add "Always in French/Spanish". `uiLanguageRule()` and `languageName()` cover fr/es.
- `scripts/i18n-check` reports missing keys for each language.
- Acceptance: `npm run i18n:check` clean for pl, fr, es. A unit test switches language and checks `t`, `tp` (0, 1, 2, 5) for each.

## 2. Anthropic-compatible provider

- Provider id `anthropic-compat`. Settings: `anthropicCompatUrl`, `anthropicCompatModel`. Secret `anthropic-compatible-api-key` (own key name, never shared with `claude`).
- Implementation: Anthropic SDK with `baseURL`, using plain `messages.create/stream` with `system`, `messages`, `max_tokens`. No `betas`, no `output_config`, no `fallbacks` (third-party servers reject them). `json: true` adds a "JSON only" system line and uses `parseJsonLoose`.
- Errors: 401 → "Invalid API key", 429 → rate limit, missing URL/model/key → "Set URL, model and key in Settings → AI". Test with a fake local HTTP server (same pattern as the OpenAI test).
- CLI/MCP: `octo ai` status line lists the new provider.

## 3. Default provider badge

- Settings → AI: the provider select stays. Each provider section header shows a pill "Used by default" when it is `ai.provider`, and a "Use by default" button otherwise (sets `ai.provider`).
- AskView label and any other provider label show the new provider.
- No behaviour change in `complete()` except routing `anthropic-compat`. Error when the active provider is unconfigured is the existing message plus the provider name.

## 4. Temporary pairing code

- Settings → Home server → Devices: "Add device" opens an inline form with an optional name, then shows the code (large, monospace), a countdown mm:ss to expiry, a Copy button (toast "Copied"), and the server URL. At 0:00 the code is cleared and "Expired" is shown with a "New code" button.
- Available in the desktop app (remote mode) and in the web UI of a paired browser. Not on the unauthenticated login page. The login page text still mentions `octo server pair`, plus a hint "or ask from a paired device".
- Server: `createPairingCode(name)` already caps at 15 min and one use. Add a limit of 5 live codes (oldest dropped) so repeated clicks cannot grow the store.
- Test: code created via API with a paired token works once; second redeem fails; expired fails; request without token gets 401 (existing tests extended).

## 5. Writing instructions

- Setting `ai.draftPrompt` (string, default `''`). Settings → AI, under "About me": textarea "Writing instructions", hint "Empty = default", a "Show default" disclosure that prints the built-in prompt, and a "Restore default" button (clears it).
- `draftReply()` builds the system prompt as: guard (locked) + persona + `draftPrompt || DEFAULT_DRAFT_PROMPT` + language rule + tone + output-format line (locked) + style sample.
- `DEFAULT_DRAFT_PROMPT` (short, numbered, small-model friendly), roughly:
  1. You write the reply to the last message on behalf of the user.
  2. Answer every question asked.
  3. Start with a short greeting that fits the thread.
  4. Never invent facts, dates or amounts; write `[to fill in]` instead.
  5. No subject, no quoted text, no signature.
- Max length 4000 characters. Stored in settings like other AI fields. Not applied to summary, categorisation, rewrite, translation, Ask.
- Test: custom prompt reaches the request body; guard and output-format lines are still present; empty uses default.

## Out of scope

Per-feature providers, automatic fallback, model-specific code paths, translation of AI prompts, new server endpoints.

## PR branches (each based on `main` after the topic is merged there)

`pr/lang-fr-es`, `pr/anthropic-compat`, `pr/default-provider-badge`, `pr/pairing-code-ui`, `pr/draft-prompt`. Order: anthropic-compat → default-provider-badge → draft-prompt → pairing-code-ui → lang-fr-es (last, it touches strings added by the others).
