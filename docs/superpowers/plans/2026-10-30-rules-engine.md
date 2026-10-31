# Rules engine upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mail rules safer and more expressive: nested conditions, an age condition, a real preview before "Apply now", and rules that run on a schedule.

**Architecture:** Conditions stay in the existing `rules.conditions` JSON column, which now accepts groups next to plain conditions, so stored rules load unchanged. One shared `applyActions` runs the actions for live mail, "apply to existing" and scheduled runs. Scheduling adds two columns and a hook in the existing scheduler tick. Agent access rules are tightened for anything that runs unattended.

**Tech Stack:** TypeScript, `node:sqlite` via `src/core/db.ts`, node:test through `scripts/run-tests.mjs`, React + Tailwind in `SettingsView.tsx`.

**Spec:** This plan. Its "Decisions" section is the design. Product intent from the owner: a stronger local rules engine, with a dry run before anything is applied to existing mail. AI conditions and a natural-language rule builder are a separate plan that depends on this one.

## Global Constraints

- Node 24: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- No commits and no pushes until the owner asks (AGENTS.md). Each task ends with a checkpoint, not a commit.
- Tests and demos use a temp `OPENMAIL_HOME` and `OPENMAIL_SECRETS=memory`. Never touch the real profile.
- New tests must not need GreenMail or any mail server.
- UI strings go through `t()` / `tp()` with entries in `src/shared/locales/{pl,fr,es}/`; `npm run i18n:check` must pass. Engine, CLI and MCP messages are English in code.
- Colors only through CSS tokens (`bg-surface`, `text-muted`, `text-accent`).
- No new npm dependencies. No changes to unrelated logic or tests.
- Rule JSON keeps living in the existing `conditions` and `actions` columns; rows written before this plan must load and match exactly as before.

Checks run at the end of every task:

```bash
npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json
npm run i18n:check
node scripts/run-tests.mjs rules
```

## Decisions

- A condition list may contain groups: `{ group: 'all' | 'any' | 'none', items: RuleNode[] }`. Groups nest up to 3 levels, and a rule holds at most 20 leaf conditions. Empty groups are invalid. `none` means "no item matches".
- New condition field `age_days` with ops `greater_than` and `less_than`. Age is `(now() - message.date) / 86_400_000` as a fraction, compared strictly. A message without a date never matches.
- "Apply to existing" scans the 500 most recent inbox messages and says when more existed (`truncated`).
- Preview counts conversations (threads), never messages, so the number matches what Apply does.
- `forward` and `notify` are dead action types today. They are removed from the type. Stored rows that still contain them are skipped with a log line.
- New action `priority` (uses `A.priority`).
- A scheduled rule runs only on its schedule, never on new mail. Schedule is local time: `at` as `HH:MM`, `days` as weekday numbers 0 (Sunday) to 6, empty meaning every day. Missed runs are not repeated: after downtime the rule runs once. Saving a rule with a new or changed schedule starts the clock at save time, so it never runs immediately.
- Actions allowed on a scheduled rule: `archive`, `mark_read`, `move`, `label`, `categorize`, `set_aside`, `trash`. The rest are rejected at save.
- Agent access: saving or applying a rule that has a schedule, or a `trash` or `block` action, needs `send` level. Other rules need `triage`, as today.
- Out of scope: regex backtracking limits (a hostile `matches` pattern can still be slow), forwarding, AI conditions, natural-language builder, team features.

## Review Focus

- A scheduled rule after the app was closed over several due times runs once, not once per missed time.
- Saving or editing a scheduled rule never triggers an immediate run; a disabled rule never runs.
- "Apply now" on a big mailbox must not claim it covered everything when it covered the newest 500.
- An agent with `triage` access must not be able to plant a persistent scheduled or destructive rule.
- Rules stored before this plan, and rules whose regex is invalid, keep working without throwing.

## File Map

- `src/shared/types.ts`: new types (Tasks 1 to 4).
- `src/core/rules.ts`: matching, validation, shared runner, preview, schedule (Tasks 1 to 4).
- `src/shared/rules.ts` (new): pure helpers `isGroup`, `SCHEDULE_SAFE_ACTIONS`, `lastOccurrence`, safe to import from the renderer (Tasks 1, 4).
- `src/core/db.ts`: one migration (Task 4).
- `src/core/scheduler.ts`, `src/core/service.ts`: wiring (Tasks 3, 4).
- `src/renderer/src/views/SettingsView.tsx`, new `RulesTab.tsx`, locale files: UI (Task 5).
- `tests/rules.test.ts` (new): all engine tests.

---

### Task 1: Condition groups

**Files:**
- Modify: `src/shared/types.ts` (near `RuleCondition`, line ~263), `src/core/rules.ts`
- Create: `tests/rules.test.ts`

**Interfaces:**
- Produces in `types.ts`: `RuleGroup { group: 'all' | 'any' | 'none'; items: RuleNode[] }`, `type RuleNode = RuleCondition | RuleGroup`; `Rule.conditions` becomes `RuleNode[]`.
- Produces in `src/shared/rules.ts` (new file): `isGroup(n: RuleNode): n is RuleGroup`.
- Produces in `src/core/rules.ts`: `nodeMatches(m: Row, n: RuleNode): boolean`, `validateConditions(nodes: RuleNode[]): void` (throws `Error` with a `t()` message), `saveRule` calls it before writing.
- `ruleMatches(rule, m)` keeps its signature; `Rule.match` still combines the top-level list.

- [ ] **Step 1: Write the failing tests in `tests/rules.test.ts`.** Header sets `OPENMAIL_HOME` (temp dir), `OPENMAIL_SECRETS=memory`, `OPENMAIL_QUIET=1`, `OPENMAIL_NO_AUTORUN=1` before importing from `../src/core/rules`, like `tests/send-again.test.ts`. Helpers: `msg(o = {}): Row` returning `{ id: 1, thread_id: 1, account_id: 1, subject: 'Invoice 42', from_name: 'Bob', from_email: 'bob@shop.test', to_json: '[]', cc_json: '[]', category: 'people', has_attachments: 0, list_id: null, snippet: '', date: Date.now(), ...o }` and `c(field, op, value)`. Tests, with `rule = { match, conditions }`:
  - `'rules saved before groups still match'`: `match:'all'`, two flat conditions on subject `invoice` and from `bob` give `true`; `match:'any'` with only the second true gives `true`.
  - `'an any-group inside an all-rule'`: `[c('from','contains','bob'), { group:'any', items:[c('subject','contains','invoice'), c('subject','contains','receipt')] }]`; subject `Receipt` gives `true`, subject `Hello` gives `false`.
  - `'a none-group excludes'`: `[{ group:'none', items:[c('subject','contains','spam')] }]`; `Hello` true, `Spam offer` false.
  - `'an invalid regex is false, not an error'`: `c('subject','matches','(')` gives `false`.
  - `'validateConditions limits'`: throws for an empty group, for groups nested 4 deep, and for 21 leaf conditions; accepts 3 levels with 20 leaves.

- [ ] **Step 2: Run `node scripts/run-tests.mjs rules`.** Expected: FAIL (exports missing).

- [ ] **Step 3: Implement** the types and the four functions. `nodeMatches` recurses; `all` = every, `any` = some, `none` = not some. `ruleMatches` returns `false` for an empty list, as today. Add the three locale entries for the validation messages in `src/shared/locales/{pl,fr,es}/core.ts`.

- [ ] **Step 4: Keep the web build green.** `Rule.conditions` is now `RuleNode[]`, so `SettingsView.tsx` stops compiling. Make the smallest change that compiles: the editor still edits flat conditions, and a rule that contains a group (none exist yet) shows its groups read-only through `isGroup`. The real editor comes in Task 5.

- [ ] **Step 5: Run the checks.** Expected: all pass.

- [ ] **Step 6: Checkpoint.** No commit. `git status` should list only the files above plus locale files.

### Task 2: Age condition

**Files:**
- Modify: `src/shared/types.ts`, `src/core/rules.ts` (`conditionMatches`, `validateConditions`), `tests/rules.test.ts`

**Interfaces:**
- Consumes: `RuleCondition`, `validateConditions` from Task 1.
- Produces: `RuleCondition['field']` gains `'age_days'`; `RuleCondition['op']` gains `'greater_than' | 'less_than'`.

- [ ] **Step 1: Add failing tests** with `const DAY = 86_400_000`: a message dated `Date.now() - 7*DAY - 1000` gives `true` for `c('age_days','greater_than','7')`, `false` for `less_than 7`, `true` for `greater_than 6`; `value 'abc'` gives `false`; `date: null` gives `false` for both ops. `validateConditions` throws for `age_days` with value `'-1'` and `'1.5x'`, and accepts `'0'` and `'30'`.

- [ ] **Step 2: Run `node scripts/run-tests.mjs rules`.** Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the numeric branch at the top of `conditionMatches`, before the string lowercase path, and the value rule in `validateConditions`.

- [ ] **Step 4: Run the checks.** Expected: pass.

- [ ] **Step 5: Checkpoint** as in Task 1.

### Task 3: Shared runner, preview and honest "Apply now"

**Files:**
- Modify: `src/shared/types.ts`, `src/core/rules.ts`, `src/core/service.ts:324-328`, `tests/rules.test.ts`

**Interfaces:**
- Consumes: `ruleMatches`, `RuleNode`.
- Produces in `types.ts`: `RulePreview { scanned: number; truncated: boolean; matchedThreads: number; sample: { threadId: number; messageId: number; subject: string; from: string; date: number }[] }` (newest first, at most 10) and `RuleApplyResult { matched: number; applied: number; truncated: boolean }`. `RuleAction.type` loses `'notify'` and `'forward'` and gains `'priority'`.
- Produces in `rules.ts`: `scanInbox(limit: number): Row[]` (inbox, not outgoing, not hidden, newest first, `SELECT m.*`), `applyActions(actions: RuleAction[], m: Row): { suppressNotify: boolean }`, `previewRule(rule: Pick<Rule, 'match' | 'conditions' | 'actions'>, limit?: number): RulePreview`, and `applyRuleToExisting(ruleId: number, limit?: number): RuleApplyResult` (default limit 500, replaces the old number return).
- `service.ts`: add `previewRule`; `applyRule` returns `RuleApplyResult`. `testRule` stays unchanged.

- [ ] **Step 1: Write failing tests** with a `seedMessage({ subject, fromEmail, ageDays, thread })` helper that writes an account, an inbox folder, a thread and a message straight into the temp database (copy the shape from `seed()` in `tests/send-again.test.ts`; read the `threads` and `folders` columns in `src/core/db.ts`):
  - `'preview counts a conversation once'`: two matching messages in one thread give `matchedThreads === 1`.
  - `'preview reports truncation'`: 5 matching messages, `limit 3` gives `scanned === 3` and `truncated === true`; `limit 5` gives `truncated === false`. Implementation fetches `limit + 1` rows.
  - `'apply archives matches and reports the result'`: after `applyRuleToExisting`, `{ matched: 2, applied: 2, truncated: false }`, each thread has `done_at` not null, `rules.hits` rose by 2, and `history` has rows with `actor = 'rule'` and `action = 'rule-applied'`.
  - `'priority action'`: a rule with `{ type: 'priority' }` sets `threads.priority = 1`.
  - `'a stored forward action is skipped'`: a rule row with `actions` JSON `[{"type":"forward","value":"x@y.test"},{"type":"archive"}]` still archives and does not throw.

- [ ] **Step 2: Run `node scripts/run-tests.mjs rules`.** Expected: FAIL.

- [ ] **Step 3: Implement.** Extract the body of `applyAction` into `applyActions`, which catches and logs per-action errors and returns `suppressNotify` for `no_notify`. `processNewMessages` calls it, keeping its own `hits` and `record` bookkeeping. `applyRuleToExisting` bumps `hits` by the number of applied conversations and records one history row per conversation with details `{ rule, existing: true }`.

- [ ] **Step 4: Update `service.ts`** with the new method and result type.

- [ ] **Step 5: Run the checks.** Expected: pass. `SettingsView.tsx` still compiles because it only uses the old `applyRule` number in one toast; change that line to read `.applied` (the full UI work is Task 5).

- [ ] **Step 6: Checkpoint.**

### Task 4: Schedules, access levels, migration

**Files:**
- Modify: `src/shared/rules.ts` (created in Task 1)
- Modify: `src/shared/types.ts`, `src/core/db.ts` (append one entry to `MIGRATIONS`), `src/core/rules.ts`, `src/core/scheduler.ts` (`tick`), `src/core/service.ts`, locale files, `tests/rules.test.ts`

**Interfaces:**
- Consumes: `applyActions`, `scanInbox`, `ruleMatches`, `validateConditions`.
- Produces in `types.ts`: `RuleSchedule { at: string; days: number[] }`; `Rule.schedule: RuleSchedule | null`; `Rule.lastRunAt: number | null`.
- Produces in `src/shared/rules.ts`: `SCHEDULE_SAFE_ACTIONS: RuleAction['type'][]` and `lastOccurrence(s: RuleSchedule, nowMs: number): number` (latest scheduled local time at or before `nowMs`, searching back 8 days).
- Produces in `src/core/rules.ts`: `validateRule(r: Pick<Rule, 'conditions' | 'actions' | 'schedule'>): void` (calls `validateConditions`; rejects bad `at`, days outside 0 to 6, and unsafe actions on a scheduled rule; `saveRule` calls it), `requiredAccess(r: Pick<Rule, 'actions' | 'schedule'>): 'triage' | 'send'`, `runDueScheduledRules(nowMs?: number): { ruleId: number; applied: number }[]`.
- Migration adds `schedule TEXT` and `last_run_at INTEGER` to `rules`.

- [ ] **Step 1: Write failing tests.** With `const at = (s: string) => new Date(s).getTime()` (no `Z`, so local time):
  - `lastOccurrence({ at:'09:00', days:[] }, at('2026-10-30T10:00'))` equals `at('2026-10-30T09:00')`; with now `at('2026-10-30T08:00')` it equals `at('2026-10-29T09:00')`.
  - `lastOccurrence({ at:'09:00', days:[1] }, at('2026-10-30T10:00'))` equals `at('2026-10-26T09:00')` (30 Oct 2026 is a Friday, 26 Oct the Monday).
  - `'schema has the new columns'`: `all('PRAGMA table_info(rules)')` lists `schedule` and `last_run_at`.
  - `'saving a schedule starts the clock'`: `saveRule` with a schedule gives `lastRunAt` within 1 s of now; saving again with only a new name keeps `lastRunAt`; changing `at` resets it.
  - `'catch-up runs once'`: scheduled daily 09:00 rule with `archive`, `lastRunAt = at('2026-10-27T09:00')`, three matching inbox threads; `runDueScheduledRules(at('2026-10-30T10:00'))` returns one entry with `applied: 3`; calling it again with the same time returns `[]`.
  - `'disabled and fresh rules do not run'`: same setup with `enabled: false` returns `[]`; a rule saved at `T` does not run at `T`.
  - `'scheduled rules ignore new mail'`: `processNewMessages` with a seeded new inbox message does not touch a matching scheduled rule (`hits` unchanged).
  - `'a scheduled run writes one history row'`: one `rule-scheduled` row for the run, not one per thread.
  - `validateRule` throws for a scheduled rule with `snooze`, for `at: '25:00'`, and for `days: [7]`; `requiredAccess` returns `'triage'` for a plain archive rule and `'send'` for a schedule, for `trash`, and for `block`.

- [ ] **Step 2: Run `node scripts/run-tests.mjs rules`.** Expected: FAIL.

- [ ] **Step 3: Implement** `lastOccurrence` with local `Date` arithmetic, the migration, `rowToRule`/`saveRule` changes (reset `last_run_at` when the schedule JSON differs from the stored one), `runDueScheduledRules` (enabled rules with a schedule where `lastOccurrence(schedule, nowMs) > lastRunAt`; scan 500, apply actions to the first matching message per thread, write `lastRunAt = nowMs`, one `record('rule', 'rule-scheduled', ruleId, { rule, applied })`), and the filter in `processNewMessages` that skips rules with a schedule.

- [ ] **Step 4: Wire** `runDueScheduledRules()` inside the existing try block of `tick()` in `scheduler.ts`. In `service.ts`, `saveRule` and `applyRule` call `need(rules.requiredAccess(rule), 'any')` when called by an agent.

- [ ] **Step 5: Run the checks.** Expected: pass.

- [ ] **Step 6: Checkpoint.**

### Task 5: Rules editor UI

**Files:**
- Create: `src/renderer/src/views/RulesTab.tsx` (move `RulesTab` and its `FIELDS`, `OPS`, `ACTIONS` from `SettingsView.tsx:508-600` unchanged first)
- Modify: `src/renderer/src/views/SettingsView.tsx`, `src/shared/locales/{pl,fr,es}/settings.ts`

**Interfaces:**
- Consumes: `Rule`, `RuleNode`, `RuleSchedule`, `RulePreview`, `RuleApplyResult`; `api.previewRule`, `api.applyRule`, `api.saveRule`.

- [ ] **Step 1: Move `RulesTab` into `RulesTab.tsx` with no behavior change.** Run `npx tsc --noEmit -p tsconfig.web.json`. Expected: no errors.

- [ ] **Step 2: Add the recursive editor.** A `ConditionNodeEditor` renders a condition row or a group card (all / any / none selector, "Add condition", "Add group", remove). The add-group button hides at depth 3. Add `age_days` to the field list with the two numeric ops, offered only for that field. Add `priority` to the action list.

- [ ] **Step 3: Add the schedule block.** A toggle, an `<input type="time">`, and seven weekday toggles. When the toggle is on, the action list shows only `SCHEDULE_SAFE_ACTIONS` (imported from `src/shared/rules.ts`, never from `src/core`); turning it on removes unsafe actions already chosen, after a visible notice.

- [ ] **Step 4: Replace the test button with the preview.** It calls `api.previewRule` and shows "N conversations match", up to 10 sample subjects, and a line "Only the newest {scanned} messages were checked" when `truncated`. "Apply now" runs the preview first, asks for confirmation with the count, then applies and shows a toast using `applied` and a truncation note.

- [ ] **Step 5: Add pl, fr and es strings.** Run the checks, then `npx electron-vite build`. Expected: all succeed.

- [ ] **Step 6: Check the screen.** `npm run demo:seed && npm run demo`, open Settings, Rules. Confirm a nested group saves and reloads, a daily schedule saves, the preview lists subjects, and Apply now asks before acting, in light and dark theme.

- [ ] **Step 7: Full suite.** With a JDK 17 or newer on `PATH` or `JAVA_HOME` (Homebrew has `openjdk@21`), start `npm run greenmail` in another window, then `npm test`. Expected: 0 failures, 0 cancelled. If Java cannot start, report the cancelled tests as unverified.

- [ ] **Step 8: Checkpoint.**
