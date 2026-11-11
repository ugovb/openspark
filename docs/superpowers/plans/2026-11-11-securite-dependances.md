# Sécurité et dépendances — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Fermer les failles relevées par l'audit (injection HTML dans les réponses IA et les signatures, navigation trop permissive, fenêtres non sandboxées, ouverture de pièces jointes exécutables) et sortir des dépendances vulnérables.

**Architecture :** Chaque correctif isole sa règle dans une fonction pure et testable sans GreenMail (`escapeHtml`, `previewHtml`, `isInternalUrl`, `isRiskyAttachment`), puis le code existant l'appelle. Les dépendances sont montées à la fin, une fois les tests en place.

**Tech Stack :** TypeScript, Electron 44, React 19, DOMPurify, node:test via `scripts/run-tests.mjs`, jsdom (tests uniquement).

**Spec :** `docs/superpowers/specs/2026-11-11-audit-openmail.md`, section A.

## Global Constraints

- Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:$PATH` sur macOS).
- Pas de commit ni de push sans demande du propriétaire (AGENTS.md) : chaque tâche finit par un point de contrôle. Avant la tâche 3, faire commiter par le propriétaire le correctif `showWindow` déjà présent dans `src/main/index.ts`.
- Tests et démos : `OPENMAIL_HOME` temporaire et `OPENMAIL_SECRETS=memory`. Ne jamais toucher le vrai profil ni le trousseau.
- Les nouveaux tests ne demandent ni GreenMail ni serveur de mail.
- Textes d'interface via `t()` avec entrées dans `src/shared/locales/{pl,fr,es}/` ; `npm run i18n:check` doit passer.
- Nouvelle dépendance npm : uniquement `jsdom` en devDependency, version exacte `30.1.3`.
- Aucune modification de logique sans rapport.

Contrôles en fin de chaque tâche :

```bash
npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json
npm run i18n:check
OPENMAIL_SECRETS=memory node scripts/run-tests.mjs <fichier de la tâche>
```

## Review Focus

- Une URL avec `"`, `'` ou `<` dans une réponse IA reste un lien cliquable et inerte (tâche 1).
- Une signature en texte brut contenant `Nom <adresse@x>` s'affiche telle quelle au lieu de disparaître (tâche 2).
- `npm run dev` : recharger la fenêtre et ouvrir une conversation dans une nouvelle fenêtre (`?thread=`) marchent toujours (tâche 3).
- Ouvrir un `.pdf` ne demande jamais de confirmation ; annuler la confirmation n'affiche pas d'erreur (tâche 4).
- Après nodemailer 10, l'envoi avec pièces jointes et les invitations iTIP (`MailComposer`) fonctionnent (tâche 6).

## Carte des fichiers

- `src/renderer/src/lib/format.ts` : `escapeHtml`, `mdToHtml`, `plainToHtml` (tâche 1).
- `src/renderer/src/lib/sanitize.ts` (nouveau) : `sanitizeFragment`, `looksLikeHtml`, `previewHtml` (tâche 2).
- `src/main/navigation.ts` (nouveau) : `isInternalUrl` (tâche 3).
- `src/main/attachments.ts` (nouveau) : `isRiskyAttachment` (tâche 4).
- `src/main/index.ts` : branchements (tâches 3, 4, 5).
- `package.json`, `package-lock.json` : versions (tâches 2, 6).

---

### Tâche 1 : échapper les guillemets dans le rendu Markdown de l'IA

**Files :**
- Modify : `src/renderer/src/lib/format.ts:81-110`
- Test : `tests/format.test.ts` (nouveau)

**Interfaces :**
- Produces : `export function escapeHtml(s: string): string` dans `format.ts` — échappe `&`, `<`, `>`, `"` (→ `&quot;`), `'` (→ `&#39;`). Utilisée par la tâche 2.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { escapeHtml, mdToHtml, plainToHtml } from '../src/renderer/src/lib/format'

describe('mdToHtml', () => {
  it('keeps quotes inside link targets', () => {
    const html = mdToHtml('see https://x.test/a"style="background:url(//evil.test/p)')
    assert.doesNotMatch(html, /href="[^"]*"style=/)
    assert.match(html, /href="https:\/\/x\.test\/a&quot;style=&quot;background:url\(\/\/evil\.test\/p\)"/)
  })
  it('escapes quotes in plain text', () => {
    assert.equal(mdToHtml(`it's "fine"`), '<p>it&#39;s &quot;fine&quot;</p>')
  })
  it('still links message references', () => {
    assert.equal(mdToHtml('see [#12]'), '<p>see <a href="#msg-12" data-msg="12">[#12]</a></p>')
  })
})

describe('escapeHtml / plainToHtml', () => {
  it('escapes the five HTML characters', () => assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'))
  it('plainToHtml escapes quotes', () => assert.ok(plainToHtml('a "b"').includes('&quot;b&quot;')))
})
```

- [ ] **Étape 2 : lancer et constater l'échec**

Run : `node scripts/run-tests.mjs format`
Expected : FAIL — `escapeHtml` n'est pas exporté, et `quotes inside link targets` échoue.

- [ ] **Étape 3 : implémenter `escapeHtml(s: string): string`** et l'utiliser à la place des deux `esc` locaux de `mdToHtml` et `plainToHtml`.

- [ ] **Étape 4 : relancer**

Run : `node scripts/run-tests.mjs format` puis `node scripts/run-tests.mjs markdown`
Expected : PASS, 0 fail.

- [ ] **Étape 5 : point de contrôle** (contrôles globaux ; pas de commit sans accord).

---

### Tâche 2 : assainir signatures et modèles affichés

**Files :**
- Create : `src/renderer/src/lib/sanitize.ts`
- Modify : `src/renderer/src/views/SettingsView.tsx:448`, `src/renderer/src/components/Composer.tsx:236` et `:693`, `package.json` (devDependency `"jsdom": "30.1.3"`)
- Test : `tests/sanitize.test.ts` (nouveau)

**Interfaces :**
- Consumes : `escapeHtml` (tâche 1).
- Produces :
  - `sanitizeFragment(html: string): string` — DOMPurify avec `FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'meta', 'link', 'base']` et `FORBID_ATTR: ['formaction', 'action', 'ping']`. L'instance est créée paresseusement au premier appel par `DOMPurify(window)`, pour que les tests puissent installer une fenêtre jsdom avant.
  - `looksLikeHtml(s: string): boolean` — vrai seulement si `s` contient une balise connue : `/<\/?(p|div|br|span|a|b|i|u|strong|em|img|table|tr|td|font|ul|ol|li|h[1-6]|hr|blockquote)\b[^>]*>/i`.
  - `previewHtml(s: string): string` — `looksLikeHtml(s) ? sanitizeFragment(s) : escapeHtml(s).replace(/\r?\n/g, '<br>')`.

- [ ] **Étape 1 : ajouter jsdom** : `npm install --save-dev --save-exact jsdom@30.1.3`.

- [ ] **Étape 2 : écrire les tests qui échouent**

```ts
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { looksLikeHtml, previewHtml, sanitizeFragment } from '../src/renderer/src/lib/sanitize'

before(() => {
  const { window } = new JSDOM('')
  Object.assign(globalThis, { window, document: window.document })
})

describe('sanitizeFragment', () => {
  it('drops scripts and handlers, keeps formatting', () =>
    assert.equal(sanitizeFragment('<b onclick="x()">Hi</b><script>alert(1)</script>'), '<b>Hi</b>'))
  it('keeps links and images', () =>
    assert.equal(sanitizeFragment('<a href="https://a.test">a</a><img src="https://a.test/l.png">'), '<a href="https://a.test">a</a><img src="https://a.test/l.png">'))
  it('drops javascript: links', () => assert.equal(sanitizeFragment('<a href="javascript:alert(1)">x</a>'), '<a>x</a>'))
})

describe('previewHtml', () => {
  it('shows plain text with an address as text', () =>
    assert.equal(previewHtml('Ugo <ugo@x.test>\nCEO'), 'Ugo &lt;ugo@x.test&gt;<br>CEO'))
  it('treats real markup as HTML', () => {
    assert.equal(looksLikeHtml('<p>Hi</p>'), true)
    assert.equal(looksLikeHtml('Ugo <ugo@x.test>'), false)
    assert.equal(previewHtml('<p onmouseover="x()">Hi</p>'), '<p>Hi</p>')
  })
})
```

- [ ] **Étape 3 : lancer et constater l'échec**

Run : `node scripts/run-tests.mjs sanitize`
Expected : FAIL — module `sanitize` introuvable.

- [ ] **Étape 4 : implémenter `sanitize.ts`** selon les signatures ci-dessus.

- [ ] **Étape 5 : brancher** : `SettingsView.tsx:448` → `__html: previewHtml(edit.html)` ; `Composer.tsx:236` → `sanitizeFragment(s.html)` ; `Composer.tsx:693` → `sanitizeFragment(sigHtml)`. Vérifier qu'il ne reste aucun `dangerouslySetInnerHTML` alimenté par une signature ou un modèle : `grep -rn "dangerouslySetInnerHTML" src/renderer/src` ne doit plus montrer que `mdToHtml(…)`, le SVG du QR code et les trois appels ci-dessus.

- [ ] **Étape 6 : relancer**

Run : `node scripts/run-tests.mjs sanitize`
Expected : PASS, 0 fail.

- [ ] **Étape 7 : point de contrôle.**

---

### Tâche 3 : n'autoriser la navigation que vers l'interface de l'application

**Files :**
- Create : `src/main/navigation.ts`
- Modify : `src/main/index.ts:104-109` (gestionnaire `will-navigate`)
- Test : `tests/navigation.test.ts` (nouveau)

**Interfaces :**
- Produces : `export function isInternalUrl(url: string, app: { devUrl?: string; indexFile: string }): boolean` — vrai si `url` a la même origine que `devUrl` (quand il est défini), ou si c'est une URL `file:` dont le chemin (sans requête ni fragment, via `fileURLToPath`) est exactement `path.resolve(indexFile)`. Toute URL invalide renvoie `false`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { isInternalUrl } from '../src/main/navigation'

const indexFile = path.resolve('/opt/OpenMail/out/renderer/index.html')
const dev = { devUrl: 'http://localhost:5173/', indexFile }

describe('isInternalUrl', () => {
  it('accepts the dev server, with a query', () => assert.equal(isInternalUrl('http://localhost:5173/?thread=4', dev), true))
  it('rejects look-alike hosts and other ports', () => {
    assert.equal(isInternalUrl('http://localhost.evil.test/', dev), false)
    assert.equal(isInternalUrl('http://localhost:6000/', dev), false)
    assert.equal(isInternalUrl('https://example.com/', dev), false)
  })
  it('rejects localhost when there is no dev server', () => assert.equal(isInternalUrl('http://localhost:5173/', { indexFile }), false))
  it('accepts only the renderer index file', () => {
    assert.equal(isInternalUrl(`${pathToFileURL(indexFile)}?thread=2`, { indexFile }), true)
    assert.equal(isInternalUrl(pathToFileURL(path.resolve('/etc/passwd')).toString(), { indexFile }), false)
    assert.equal(isInternalUrl(pathToFileURL(path.join(path.dirname(indexFile), 'other.html')).toString(), { indexFile }), false)
  })
  it('rejects garbage', () => assert.equal(isInternalUrl('not a url', dev), false))
})
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs navigation` — Expected : FAIL, module introuvable.

- [ ] **Étape 3 : implémenter `isInternalUrl`** puis remplacer la condition de `will-navigate` par `!isInternalUrl(url, { devUrl: process.env.ELECTRON_RENDERER_URL, indexFile: path.join(__dirname, '../renderer/index.html') })`. Le reste du gestionnaire (ouverture externe des `http(s)`/`mailto`) ne change pas.

- [ ] **Étape 4 : relancer** — Run : `node scripts/run-tests.mjs navigation` — Expected : PASS.

- [ ] **Étape 5 : vérification manuelle** : `npm run dev` avec un `OPENMAIL_HOME` temporaire ; Ctrl/Cmd+R recharge la fenêtre ; « Ouvrir dans une nouvelle fenêtre » sur une conversation affiche la conversation.

- [ ] **Étape 6 : point de contrôle.**

---

### Tâche 4 : confirmer l'ouverture des pièces jointes exécutables

**Files :**
- Create : `src/main/attachments.ts`
- Modify : `src/main/index.ts` (gestionnaire `open-attachment`), `src/preload/api.d.ts` si le type de retour de `openAttachment` y est déclaré, `src/shared/locales/{pl,fr,es}/platform.ts`
- Test : `tests/attachments.test.ts` (nouveau)

**Interfaces :**
- Produces : `export function isRiskyAttachment(filename: string): boolean` — insensible à la casse, sur la dernière extension seulement. Liste : `exe msi bat cmd com scr pif ps1 vbs vbe js jse wsf wsh hta cpl msc jar lnk reg app pkg dmg command sh desktop appimage deb rpm run iso img vhd docm xlsm pptm`.
- `open-attachment` renvoie `Promise<string | null>` (`null` = annulé).

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isRiskyAttachment } from '../src/main/attachments'

describe('isRiskyAttachment', () => {
  it('flags programs and scripts', () => {
    for (const f of ['setup.exe', 'facture.pdf.exe', 'RUN.CMD', 'x.app', 'install.sh', 'a.desktop', 'macro.docm']) assert.equal(isRiskyAttachment(f), true, f)
  })
  it('lets documents through', () => {
    for (const f of ['rapport.pdf', 'photo.JPG', 'archive.tar.gz', 'noext', '.hidden', 'notes.exe.txt']) assert.equal(isRiskyAttachment(f), false, f)
  })
})
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs attachments` — Expected : FAIL.

- [ ] **Étape 3 : implémenter `isRiskyAttachment`.**

- [ ] **Étape 4 : brancher la confirmation** dans `open-attachment` : nom affiché = `path.basename(file).replace(/^\d+(_\d+)*-/, '')` (même règle que `save-attachment`) ; si risqué, `dialog.showMessageBox(win!, { type: 'warning', message, detail, buttons: [t('Open anyway'), t('Cancel')], defaultId: 1, cancelId: 1 })` et renvoyer `null` si `response !== 0`. Textes :

| Clé (anglais) | pl | fr | es |
| --- | --- | --- | --- |
| `“{name}” can run programs on this computer.` | `„{name}” może uruchamiać programy na tym komputerze.` | `« {name} » peut lancer des programmes sur cet ordinateur.` | `«{name}» puede ejecutar programas en este equipo.` |
| `Open it only if you trust the sender.` | `Otwieraj go tylko wtedy, gdy ufasz nadawcy.` | `Ouvrez-le seulement si vous faites confiance à l'expéditeur.` | `Ábrelo solo si confías en el remitente.` |
| `Open anyway` | `Otwórz mimo to` | `Ouvrir quand même` | `Abrir de todos modos` |

`Cancel` existe déjà dans les locales (vérifier avec `npm run i18n:check`).

- [ ] **Étape 5 : relancer** — Run : `node scripts/run-tests.mjs attachments && npm run i18n:check` — Expected : PASS, aucune clé manquante.

- [ ] **Étape 6 : vérification manuelle** : dans le profil démo, ouvrir une pièce jointe `.pdf` (pas de dialogue) ; ouvrir un `.sh` (dialogue, « Annuler » ne produit aucun toast d'erreur).

- [ ] **Étape 7 : point de contrôle.**

---

### Tâche 5 : activer le sandbox des fenêtres

**Files :**
- Modify : `src/main/index.ts:87` (`sandbox: false` → `sandbox: true`)

Pas de test automatisé possible sans lancer Electron ; la vérification est manuelle et chaque point doit être coché.

- [ ] **Étape 1 : passer `sandbox` à `true`.**

- [ ] **Étape 2 : construire** — Run : `npx electron-vite build` — Expected : build sans erreur ; `out/preload/index.js` ne fait `require` que de `electron`.

- [ ] **Étape 3 : vérifier dans l'application** (`npm run demo:seed && npm run demo`) :
  - la boîte de réception s'affiche (`window.openmail` est défini) ;
  - `document.documentElement.dataset.platform` vaut la plateforme (DevTools) ;
  - glisser un fichier dans un brouillon l'ajoute en pièce jointe (`webUtils.getPathForFile`) ;
  - un résumé IA en streaming s'affiche progressivement (canal `ai-delta`).

- [ ] **Étape 4 : point de contrôle.**

---

### Tâche 6 : monter les dépendances vulnérables

**Files :**
- Modify : `package.json`, `package-lock.json`

Versions : `"electron": "^44.11.1"`, `"nodemailer": "^10.5.0"`, `"zod": "^4.6.7"` ; supprimer `@types/nodemailer` (nodemailer 10.5.0 fournit ses types, `dist/cjs/nodemailer.d.ts`) ; ajouter `"overrides": { "nodemailer": "$nodemailer" }` pour que mailparser utilise la même version.

- [ ] **Étape 1 : modifier `package.json`** comme ci-dessus, puis `npm install` et `npm audit fix` (sans `--force`).

- [ ] **Étape 2 : vérifier l'audit** — Run : `npm audit --omit=dev --audit-level=high` — Expected : code de sortie 0. Run : `npm audit` — Expected : seule `minimatch` (via electron-builder) peut rester.

- [ ] **Étape 3 : typecheck** — les deux `tsc`. Points à surveiller : l'import `nodemailer/lib/mail-composer` (`src/core/send.ts:4`, `src/core/calendar/itip.ts:5`) et les schémas zod de `src/cli/mcp.ts`. Corriger uniquement ce que le compilateur signale.

- [ ] **Étape 4 : suite complète avec GreenMail** (Java 17+) — Run : `npm run greenmail` dans un autre terminal, puis `npm test` — Expected : 0 fail, 0 cancelled. Sans Java sur la machine, pousser la branche et vérifier le job CI « Testy ».

- [ ] **Étape 5 : CLI et MCP** — Run : `OPENMAIL_HOME=$(mktemp -d) OPENMAIL_SECRETS=memory node out/cli/openmail.js help` après `npm run build` — Expected : aide affichée, code 0.

- [ ] **Étape 6 : point de contrôle.**

## Hors périmètre

`server.requestTimeout = 0` (le commentaire est faux : SSE n'en dépend pas ; à régler avec une politique de délais du serveur), signature et notarisation des binaires, mise à jour automatique, montées majeures imapflow 2 et SDK Anthropic 1.x.
