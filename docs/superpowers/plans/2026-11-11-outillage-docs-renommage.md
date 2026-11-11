# Outillage, documentation et renommage — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Faire tourner les tests unitaires partout (y compris macOS) sans serveur de mail, ajouter un linter, remettre la documentation à jour et retirer les identifiants `octo` non persistés sans déconnecter personne.

**Architecture :** `run-tests.mjs` apprend à exclure les deux fichiers qui exigent GreenMail ; un job CI « unit » les lance sur trois OS. Les noms hérités encore lus (cookie, en-tête) sont regroupés dans un seul module serveur ; un test interdit tout autre identifiant `octo` dans `src/`.

**Tech Stack :** node:test, GitHub Actions, Biome (lint seul), TypeScript, Electron `protocol`.

**Spec :** `docs/superpowers/specs/2026-11-11-audit-openmail.md`, section C. À exécuter après les deux autres plans (les tâches 1 et 2 touchent la CI et le lint, qui couvriront leurs fichiers).

## Global Constraints

- Node 24 ; pas de commit ni de push sans demande du propriétaire (AGENTS.md) : chaque tâche finit par un point de contrôle.
- Tests et démos : `OPENMAIL_HOME` temporaire, `OPENMAIL_SECRETS=memory|file`. Nouveaux tests sans GreenMail.
- Nouvelle dépendance : `@biomejs/biome` en devDependency, version exacte `2.6.3`. Formateur Biome désactivé (pas de reformatage massif).
- Restent inchangés : les marqueurs écrits dans les mails et brouillons (`octo-quote`, `octo-att`, `octo-signature`, en-tête `x-octopus-draft`), la commande `octo` et les variables `OCTO_*` (alias documentés).
- Une session web ouverte avant la mise à jour reste connectée (cookie hérité lu).

Contrôles en fin de chaque tâche :

```bash
npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json
npm run i18n:check
npm run test:unit
```

## Review Focus

- Un navigateur connecté avec l'ancien cookie `octo_token` reste connecté et peut écrire (tâche 4 : test `sessionToken`).
- Une page web d'avant la mise à jour qui envoie encore `X-Octo: 1` n'est pas refusée (tâche 4 : test `isAppRequest`).
- Une réponse à un mail envoyé par une ancienne version replie toujours la citation (`octo-quote` reste reconnu ; tâche 4 : liste d'exceptions du test).
- Les images intégrées (`cid:`) s'affichent encore après le changement de protocole (tâche 4 : CSP de `index.html` et `mailCsp` mis à jour ensemble, vérification manuelle).
- `npm test` complet (CI Linux/Windows avec GreenMail) lance toujours tous les fichiers (tâche 1 : test du filtre).

## Carte des fichiers

- `scripts/run-tests.mjs`, `scripts/test-files.mjs` (nouveau), `package.json`, `.github/workflows/ci.yml` (tâches 1, 2).
- `biome.json` (nouveau), `tsconfig.node.json`, `tsconfig.web.json` (tâche 2).
- `README.md`, `README_pl.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/screenshots/desktop.png` (tâche 3).
- `src/server/web-session.ts` (nouveau), `src/server/server.ts`, `src/renderer/src/lib/web-bridge.ts`, `src/main/index.ts`, `src/renderer/index.html`, `src/preload/index.ts`, composants et CSS du renderer (tâche 4).

---

### Tâche 1 : tests unitaires sans GreenMail, sur trois OS

**Files :**
- Create : `scripts/test-files.mjs`
- Modify : `scripts/run-tests.mjs:10-15`, `package.json` (scripts), `.github/workflows/ci.yml`
- Test : `tests/test-files.test.ts` (nouveau)

**Interfaces :**
- Produces : `export const MAIL_SERVER_TESTS = ['integration.test.ts', 'server.test.ts']` et `export function selectTests(files: string[], opts: { unit: boolean; filter?: string }): string[]` — garde les `*.test.ts`, retire `MAIL_SERVER_TESTS` si `unit`, puis applique `filter` (sous-chaîne) s'il est donné.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { MAIL_SERVER_TESTS, selectTests } from '../scripts/test-files.mjs'
const all = ['a.test.ts', 'integration.test.ts', 'server.test.ts', 'server-client.test.ts', 'demo-seed.ts', 'calendar.test.mjs']
it('full run keeps every engine test', () => assert.deepEqual(selectTests(all, { unit: false }), ['a.test.ts', 'integration.test.ts', 'server.test.ts', 'server-client.test.ts']))
it('unit run drops the mail-server tests only', () => assert.deepEqual(selectTests(all, { unit: true }), ['a.test.ts', 'server-client.test.ts']))
it('filter still works', () => assert.deepEqual(selectTests(all, { unit: true, filter: 'server' }), ['server-client.test.ts']))
it('lists files that exist', () => { for (const f of MAIL_SERVER_TESTS) assert.ok(fs.existsSync(path.join('tests', f)), f) })
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs test-files` — Expected : FAIL, module introuvable.

- [ ] **Étape 3 : implémenter `test-files.mjs`**, puis dans `run-tests.mjs` : `const args = process.argv.slice(2)`, `unit = args.includes('--unit')`, `filter = args.find((a) => !a.startsWith('--'))`, entrées = `selectTests(readdirSync('tests'), { unit, filter })`.

- [ ] **Étape 4 : script npm** : `"test:unit": "node scripts/run-tests.mjs --unit && node --test tests/calendar.test.mjs"`.

- [ ] **Étape 5 : relancer** — Run : `npm run test:unit` sur une machine sans Java — Expected : `fail 0`, `cancelled 0`.

- [ ] **Étape 6 : CI** : ajouter dans `ci.yml` un job `unit` (« Testy jednostkowe (${{ matrix.os }}) »), matrice `[ubuntu-latest, windows-latest, macos-latest]`, étapes : checkout, setup-node 24 avec cache npm, `npm ci`, les deux `tsc`, `npm run i18n:check`, `npm run test:unit`. Le job `test` existant ne change pas.

- [ ] **Étape 7 : point de contrôle** (le job macOS se vérifie au premier push autorisé par le propriétaire).

---

### Tâche 2 : linter Biome et variables inutilisées

**Files :**
- Create : `biome.json`
- Modify : `package.json` (devDependency, script `lint`), `tsconfig.node.json`, `tsconfig.web.json` (`"noUnusedLocals": true`), `.github/workflows/ci.yml` (job `unit`), fichiers signalés

- [ ] **Étape 1 : installer** — `npm install --save-dev --save-exact @biomejs/biome@2.6.3`.

- [ ] **Étape 2 : configurer `biome.json`** : `formatter.enabled: false`, `assist.enabled: false`, `linter.rules.recommended: true`, `files.includes: ["src/**", "tests/**", "scripts/**", "!**/locales/**"]`. Script : `"lint": "biome lint"`.

- [ ] **Étape 3 : constater l'état** — Run : `npm run lint` — Expected : des diagnostics. Les compter par règle (`npm run lint -- --reporter=summary`).

- [ ] **Étape 4 : trancher règle par règle** : une règle avec 10 diagnostics ou moins est corrigée dans le code ; au-delà, elle passe à `"off"` dans `biome.json` et figure dans la liste « Règles désactivées » à la fin de ce plan (nom et nombre), pour un plan ultérieur. Aucune correction ne change de comportement ; si une correction en change un, désactiver la règle à la place.

- [ ] **Étape 5 : `noUnusedLocals: true`** dans les deux tsconfig ; supprimer chaque déclaration signalée par `tsc`.

- [ ] **Étape 6 : vérifier** — Run : `npm run lint && npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json && npm run test:unit` — Expected : 0 diagnostic, 0 erreur, 0 fail.

- [ ] **Étape 7 : CI** : ajouter `npm run lint` au job `unit`, après les `tsc`.

- [ ] **Étape 8 : point de contrôle.**

---

### Tâche 3 : documentation à jour

**Files :**
- Modify : `README.md`, `README_pl.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/screenshots/desktop.png`
- Test : `tests/docs.test.ts` (nouveau)

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
const read = (f: string) => fs.readFileSync(f, 'utf8')
const DOCS = ['README.md', 'README_pl.md', 'SECURITY.md', 'CONTRIBUTING.md']
it('no retired names in the docs', () => {
  for (const f of DOCS) for (const bad of ['octo serve', 'OCTO_HOME', 'OCTO_SECRETS', '%APPDATA%\\Octopus Mail', '~/.config/Octopus Mail', 'exec octopus'])
    assert.ok(!read(f).includes(bad), `${f}: ${bad}`)
})
it('the READMEs list all four languages', () => {
  for (const w of ['French', 'Spanish']) assert.match(read('README.md'), new RegExp(w))
  for (const w of ['francusk', 'hiszpańsk']) assert.match(read('README_pl.md'), new RegExp(w))
})
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs docs` — Expected : FAIL.

- [ ] **Étape 3 : corriger les docs** :
  - `README.md:28` : « The app speaks **English, Polish, French and Spanish** » ; `README_pl.md:55` : équivalent polonais avec francuski et hiszpański.
  - `README.md:138` : dossiers `%APPDATA%\OpenMail`, `~/.config/OpenMail`, `~/Library/Application Support/OpenMail`.
  - `SECURITY.md:16` : `openmail serve`.
  - `CONTRIBUTING.md:16-17` : `OPENMAIL_HOME`, `OPENMAIL_SECRETS`.
  - `README_pl.md:111` : nom du service de `deploy/docker-compose.yml`.
  - La mention du fork Octopus Mail (`README.md:19`, `:34`) reste.

- [ ] **Étape 4 : relancer** — Expected : PASS.

- [ ] **Étape 5 : régénérer `desktop.png`** sur une machine avec écran : `node scripts/demo.mjs seed en`, puis `node scripts/demo.mjs shots docs/screenshots` avec un fichier d'étapes `[{ "name": "desktop", "wait": 4000 }]` passé en deuxième argument. Vérifier que l'image montre le logo enveloppe et l'accent bleu. Les captures téléphone et calendrier restent pour plus tard.

- [ ] **Étape 6 : point de contrôle.**

---

### Tâche 4 : retirer les identifiants `octo` non persistés

**Files :**
- Create : `src/server/web-session.ts`
- Modify : `src/server/server.ts` (lignes 66-75, 240, 283, 308, 313, 426), `src/renderer/src/lib/web-bridge.ts:13` et `:240`, `src/main/index.ts:61`, `:161`, `:487`, `:597-601`, `src/renderer/index.html` (CSP), `src/renderer/src/components/MessageFrame.tsx`, `src/renderer/src/lib/thread-actions.tsx:103`, `src/renderer/src/App.tsx:29`, `src/renderer/src/components/CommandPalette.tsx:156`, `src/renderer/src/views/SearchView.tsx:67`, `src/renderer/src/index.css` (animations), `src/core/sync.ts:541-596`, `src/preload/index.ts`, `src/shared/locales/{pl,fr,es}/platform.ts:46`
- Test : `tests/web-session.test.ts`, `tests/no-octo-identifiers.test.ts` (nouveaux) ; `tests/no-window-octo.test.ts` (étendu)

**Interfaces :**
- Produces (dans `web-session.ts`) :
  - `SESSION_COOKIE = 'openmail_token'`, `LEGACY_SESSION_COOKIE = 'octo_token'`
  - `readCookie(header: string | undefined, name: string): string | null`
  - `sessionToken(header: string | undefined): string | null` — le nouveau cookie d'abord, sinon l'ancien
  - `sessionCookie(token: string, secure: boolean): string` — `openmail_token=<encodé>; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`, suivi de `; Secure` si `secure`
  - `clearSessionCookies(secure: boolean): string[]` — les deux noms avec `Max-Age=0`
  - `isAppRequest(headers: IncomingHttpHeaders): boolean` — `x-openmail` vaut `'1'`, ou l'ancien `x-octo` vaut `'1'`

Renommages : `octo-cid` → `openmail-cid` ; classes et animations `octo-q`, `octo-plain`, `octo-in`, `octo-drawer`, `octo-slide-right` → préfixe `om-` ; attribut `data-octo-src` → `data-om-src` ; évènement `octo-search` → `openmail-search` ; préfixe temporaire `octo-print-` → `openmail-print-` ; variable `octoDraft` → `draftHeader` ; `app._octoStopped` → variable de module `let engineStopped = false` ; en-tête envoyé par `web-bridge` `X-OpenMail: 1` ; message `Missing X-Octo header` → `Missing X-OpenMail header` (pl : `Brak nagłówka X-OpenMail`, fr : `En-tête X-OpenMail manquant`, es : `Falta el encabezado X-OpenMail`) ; suppression de `contextBridge.exposeInMainWorld('octo', api)`. `QUOTE_SELECTORS` garde `.octo-quote`.

- [ ] **Étape 1 : écrire les tests qui échouent**

`tests/web-session.test.ts` :

```ts
it('reads the new cookie, then the legacy one', () => {
  assert.equal(sessionToken('a=1; openmail_token=new%2B; octo_token=old'), 'new+')
  assert.equal(sessionToken('octo_token=old'), 'old')
  assert.equal(sessionToken(undefined), null)
})
it('writes and clears cookies', () => {
  assert.equal(sessionCookie('t+1', true), 'openmail_token=t%2B1; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000; Secure')
  assert.deepEqual(clearSessionCookies(false).map((c) => c.split('=')[0]), ['openmail_token', 'octo_token'])
})
it('accepts both app headers', () => {
  assert.equal(isAppRequest({ 'x-openmail': '1' }), true)
  assert.equal(isAppRequest({ 'x-octo': '1' }), true)
  assert.equal(isAppRequest({}), false)
})
```

`tests/no-octo-identifiers.test.ts` : parcourt `src/**/*.{ts,tsx,css,html}` et relève `/\bocto(?:[-_][a-z0-9]+(?:-[a-z0-9]+)*|[A-Z]\w*)|_octo\w*/g` (sensible à la casse, pour ne pas attraper « Octopus Mail » de la migration) et `/x-octo\b/gi`. Autorisés partout : `octo-quote`, `octo-att`, `octo-signature`. Autorisés seulement dans `src/server/web-session.ts` : `octo_token`, `x-octo`. Le message d'échec liste `fichier:ligne: occurrence`.

`tests/no-window-octo.test.ts` : ajouter `it('the preload does not expose window.octo')` — `src/preload/index.ts` ne contient pas `exposeInMainWorld('octo'`.

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs octo && node scripts/run-tests.mjs web-session` — Expected : FAIL, la liste des occurrences à renommer s'affiche.

- [ ] **Étape 3 : implémenter `web-session.ts`** et l'utiliser dans `server.ts` : lecture `sessionToken(req.headers.cookie)`, chaque `Set-Cookie` de connexion par `sessionCookie(token, secureFlag(req) !== '')`, chaque déconnexion par `clearSessionCookies(...)` (tableau passé tel quel à `Set-Cookie`), contrôle d'écriture par `isAppRequest(req.headers)`. Supprimer la fonction locale `cookie()` devenue inutile.

- [ ] **Étape 4 : appliquer les renommages** de la liste ci-dessus, en changeant ensemble le protocole dans `index.ts` (enregistrement et `protocol.handle`), la CSP de `src/renderer/index.html`, `mailCsp` et `cidUrl`.

- [ ] **Étape 5 : relancer** — Run : `npm run test:unit && npm run i18n:check` — Expected : PASS.

- [ ] **Étape 6 : vérifications manuelles** :
  - application de bureau (`npm run demo`) : un mail avec image intégrée l'affiche ; recherche ⌘/Ctrl+F ; tiroir et animations du mode téléphone ; impression d'une conversation ;
  - serveur domestique (`node out/cli/openmail.js serve` sur un profil temporaire) : se connecter dans un navigateur, poser à la main un cookie `octo_token` valide à la place de `openmail_token`, archiver un mail (écriture acceptée), se déconnecter (les deux cookies disparaissent).

- [ ] **Étape 7 : suite complète** avec GreenMail (`npm run greenmail` puis `npm test`) ou job CI « Testy » — Expected : 0 fail, 0 cancelled.

- [ ] **Étape 8 : point de contrôle.**

## Règles désactivées

Règles Biome mises à `"off"` dans `biome.json` (nombre de diagnostics initiaux, 715 au total) :

- `lint/style/noNonNullAssertion` : 175
- `lint/complexity/noCommaOperator` : 120
- `lint/a11y/useButtonType` : 111
- `lint/correctness/useExhaustiveDependencies` : 73
- `lint/style/useTemplate` : 46
- `lint/a11y/noStaticElementInteractions` : 33
- `lint/a11y/noAutofocus` : 20
- `lint/suspicious/noExplicitAny` : 19
- `lint/a11y/useKeyWithClickEvents` : 18
- `lint/complexity/useOptionalChain` : 14
- `lint/suspicious/noAssignInExpressions` : 14
- `lint/suspicious/noArrayIndexKey` : 11
- `lint/suspicious/noControlCharactersInRegex` : 8 (sous le seuil, mais le corriger changerait le comportement des regex)
- `lint/complexity/noImportantStyles` : 2 (sous le seuil, `!important` voulu dans le CSS)

Le champ `recommended` de Biome est déprécié : migrer vers `preset` dans un plan ultérieur.

## Hors périmètre

Renommage des marqueurs persistés (`octo-quote`, `octo-att`, `octo-signature`, `x-octopus-draft`) qui demande une migration de format ; retrait de la commande `octo` et des variables `OCTO_*` ; découpage des gros fichiers (`CalendarView.tsx`, `SettingsView.tsx`, `ical.ts`, `sync.ts`, `Composer.tsx`) ; captures téléphone et calendrier ; tri des 11 branches distantes.
