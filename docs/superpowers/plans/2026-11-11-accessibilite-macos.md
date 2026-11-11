# Accessibilité et intégration macOS — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Faire passer tous les couples texte/fond au niveau WCAG AA dans les deux thèmes, relever les plus petits textes, donner à macOS une vraie barre de menus avec ⌘, et donner un nom accessible à chaque bouton-icône.

**Architecture :** Les couleurs restent des tokens dans `index.css` ; un test lit ce fichier et vérifie chaque couple utilisé, donc toute régression future casse la CI. La barre de menus est construite par une fonction pure qui émet des commandes nommées (`AppCommand`) ; le renderer les exécute par la même fonction que ses raccourcis clavier.

**Tech Stack :** CSS (Tailwind v4, tokens), Electron `Menu`, React 19, zustand, node:test.

**Spec :** `docs/superpowers/specs/2026-11-11-audit-openmail.md`, section B. Plan indépendant du plan « Sécurité et dépendances ».

## Global Constraints

- Node 24 ; pas de commit ni de push sans demande du propriétaire (AGENTS.md) : chaque tâche finit par un point de contrôle.
- Tests et démos : `OPENMAIL_HOME` temporaire, `OPENMAIL_SECRETS=memory`. Nouveaux tests sans GreenMail.
- Couleurs uniquement par tokens (`bg-surface`, `text-muted`…) ; aucune couleur en dur ajoutée dans les composants.
- Textes d'interface via `t()` avec entrées `pl`, `fr`, `es` ; `npm run i18n:check` passe.
- Seuils : texte 4.5:1 ; icônes et pastilles de catégorie 3:1 (WCAG 1.4.11). Plancher de taille : 11.5 px.
- Aucune nouvelle dépendance npm.

Contrôles en fin de chaque tâche :

```bash
npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json
npm run i18n:check
OPENMAIL_SECRETS=memory node scripts/run-tests.mjs <fichier de la tâche>
```

## Review Focus

- Bouton primaire et ligne sélectionnée de la barre latérale (`bg-accent text-accent-fg`) restent lisibles en thème sombre (tâche 1 : couple `accent-fg`/`accent`).
- Un raccourci affiché dans un menu ne se déclenche pas deux fois (menu + clavier du renderer) (tâche 3 : `registerAccelerator: false` testé).
- Une commande « Message » sans conversation sélectionnée ne fait rien et ne lève pas d'erreur (tâche 3 : garde dans `runCommand`).
- Changer la langue de l'application renomme les menus sans redémarrer (tâche 3 : `setupMenu()` appelé dans `applyLanguage`).
- Ctrl+, ouvre les Réglages sur Windows et Linux, où il n'y a pas de barre de menus (tâche 3).

## Carte des fichiers

- `src/renderer/src/index.css` : valeurs des tokens, nouveau token `--danger-fg` (tâche 1).
- `src/renderer/src/components/ui.tsx` : `Button` variante danger (tâche 1), `IconButton` (tâche 4).
- `src/renderer/src/lib/format.ts`, `components/MessageFrame.tsx`, `lib/thread-actions.tsx` : police des mails (tâche 2).
- `src/shared/commands.ts` (nouveau), `src/main/menu.ts` (nouveau), `src/renderer/src/lib/commands.ts` (nouveau), `src/main/index.ts`, `src/renderer/src/App.tsx` (tâche 3).

---

### Tâche 1 : tokens de couleur conformes AA

**Files :**
- Modify : `src/renderer/src/index.css:5-120`, `src/renderer/src/components/ui.tsx` (variante `danger`), chaque `bg-danger … text-white` du renderer
- Test : `tests/contrast.test.ts` (nouveau)

**Interfaces :**
- Produces : token `--danger-fg` exposé en `--color-danger-fg` (classe `text-danger-fg`).

Valeurs retenues (vérifiées : couple le plus juste : accent sur hover 4.58 en clair, faint sur hover 4.87 en sombre) :

| Token | Clair (avant → après) | Sombre (avant → après) |
| --- | --- | --- |
| `--muted` | `#6e6e73` → `#5c5c62` | `#9a9aa2` → `#b0b0b8` |
| `--faint` | `#a1a1a8` → `#6b6b72` | `#6a6a72` → `#96969e` |
| `--accent` | `#1a8cff` → `#0b6bcf` | `#3d9bff` → `#4da3ff` |
| `--accent-fg` | `#ffffff` (inchangé) | `#ffffff` → `#0b1a2e` |
| `--people` | `#1a8cff` → `#0b6bcf` | inchangé |
| `--danger` | `#ff3b30` → `#c8261b` | `#ff5a52` → `#ff6b63` |
| `--danger-fg` (nouveau) | `#ffffff` | `#2a0805` |
| `--success` | `#28b463` → `#1a7a43` | inchangé |
| `--warning` | `#ff9f0a` → `#9a5200` | inchangé |
| `--pin` | `#ffb020` → `#c98400` | inchangé |
| `--notification` | `#30b0a0` → `#1f8a7d` | inchangé |
| `--newsletter` | `#ff7a1a` → `#d9620f` | inchangé |
| `--rail-faint` | `#7d828c` → `#9196a0` | `#6f747e` → `#8a8f99` |

- [ ] **Étape 1 : écrire le test qui échoue**

Le test lit `src/renderer/src/index.css`, extrait les déclarations `--nom: #rrggbb;` du bloc `:root {` (clair) et du bloc `[data-theme="dark"] {` (sombre, complété par le clair pour les tokens absents), calcule le contraste WCAG 2 (luminance relative sRGB) et vérifie dans chaque thème :

```ts
const TEXT = ['text', 'muted', 'faint', 'accent', 'danger', 'success', 'warning']
const SURFACES = ['bg', 'panel', 'surface', 'surface-2', 'hover', 'row-hover']
const PAIRS: [fg: string, bg: string, min: number][] = [
  ...TEXT.flatMap((f) => SURFACES.map((b) => [f, b, 4.5] as [string, string, number])),
  ['accent', 'accent-soft', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['danger-fg', 'danger', 4.5],
  ['rail-fg', 'rail', 4.5], ['rail-fg', 'rail-2', 4.5], ['rail-faint', 'rail', 4.5], ['rail-faint', 'rail-2', 4.5],
  ['pin', 'surface', 3], ['people', 'surface', 3], ['notification', 'surface', 3], ['newsletter', 'surface', 3],
]
// un it() par thème ; le message d'échec liste chaque couple sous le seuil avec son ratio arrondi à 2 décimales
```

Ajouter aussi `it('danger buttons use the danger-fg token')` : aucun fichier `.tsx` de `src/renderer/src` ne contient `bg-danger` et `text-white` dans la même chaîne de classes (regex `/bg-danger[^"'`]*text-white|text-white[^"'`]*bg-danger/`).

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs contrast` — Expected : FAIL, avec notamment `light faint on surface 2.57` et `dark accent-fg on accent 2.86`.

- [ ] **Étape 3 : appliquer le tableau** dans `index.css`, déclarer `--color-danger-fg: var(--danger-fg)` dans `@theme inline`, remplacer `text-white` par `text-danger-fg` partout où il accompagne `bg-danger` (`grep -rn "bg-danger" src/renderer/src`).

- [ ] **Étape 4 : relancer** — Run : `node scripts/run-tests.mjs contrast` — Expected : PASS.

- [ ] **Étape 5 : vérification visuelle** (`npm run demo`) en clair et en sombre : bouton « Nouveau message », ligne sélectionnée de la barre latérale, bouton « Supprimer » d'un dialogue, badges Personnes / Notifications / Newsletters, icône épingle.

- [ ] **Étape 6 : point de contrôle.**

---

### Tâche 2 : plancher de taille de texte et police des mails

**Files :**
- Modify : les fichiers du renderer contenant `text-[10.5px]` ou `text-[11px]` (19 occurrences, dont `CalendarView.tsx`, `ThreadList.tsx`, `Composer.tsx`), `src/renderer/src/lib/format.ts`, `src/renderer/src/components/MessageFrame.tsx:153`, `src/renderer/src/lib/thread-actions.tsx:92`
- Test : `tests/ui-floor.test.ts` (nouveau)

**Interfaces :**
- Produces : `export const MAIL_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'` dans `format.ts`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
it('no text below 11.5px in the renderer', () => {
  // parcourt src/renderer/src/**/*.tsx, relève chaque text-[Npx], échoue en listant fichier:ligne pour N < 11.5
})
it('mail bodies and print use the shared font stack', () => {
  for (const f of ['src/renderer/src/components/MessageFrame.tsx', 'src/renderer/src/lib/thread-actions.tsx']) {
    const src = fs.readFileSync(f, 'utf8')
    assert.doesNotMatch(src, /font-family:"Segoe UI Variable Text"/, f)
    assert.match(src, /MAIL_FONT/, f)
  }
})
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs ui-floor` — Expected : FAIL, 19 emplacements listés.

- [ ] **Étape 3 : remplacer** `text-[10.5px]` et `text-[11px]` par `text-[11.5px]` ; ajouter `MAIL_FONT` et l'interpoler dans le `font-family` des deux gabarits HTML.

- [ ] **Étape 4 : relancer** — Expected : PASS.

- [ ] **Étape 5 : vérification visuelle** : vue mois du calendrier (les évènements tiennent dans leur cellule), liste des conversations, un e-mail en texte brut sur macOS (police système).

- [ ] **Étape 6 : point de contrôle.**

---

### Tâche 3 : barre de menus macOS, ⌘, et commandes partagées

**Files :**
- Create : `src/shared/commands.ts`, `src/main/menu.ts`, `src/renderer/src/lib/commands.ts`
- Modify : `src/main/index.ts` (`setupMenu`, `applyLanguage`), `src/renderer/src/App.tsx:55-140` et `:191`, `src/shared/locales/{pl,fr,es}/platform.ts`
- Test : `tests/menu.test.ts` (nouveau)

**Interfaces :**
- Produces :
  - `src/shared/commands.ts` : `export const APP_COMMANDS = ['compose', 'settings', 'search', 'palette', 'sync', 'reply', 'replyall', 'forward', 'archive', 'trash', 'snooze', 'pin', 'toggleRead'] as const`, `export type AppCommand = (typeof APP_COMMANDS)[number]`, `export function isAppCommand(x: unknown): x is AppCommand`.
  - `src/main/menu.ts` : `export function appMenuTemplate(appName: string, send: (c: AppCommand) => void): MenuItemConstructorOptions[]` (import de type seulement depuis `electron`).
  - `src/renderer/src/lib/commands.ts` : `export function runCommand(c: AppCommand): void`.

Structure du menu (libellés anglais passés dans `t()`, chaque élément personnalisé avec `registerAccelerator: false`, le clavier restant géré par le renderer) :

| Menu | Éléments (raccourci → commande) |
| --- | --- |
| `appName` | `about` ; `Settings…` (`CmdOrCtrl+,` → `settings`) ; `services` ; `hide`, `hideOthers`, `unhide` ; `quit` |
| File | `New Message` (`CmdOrCtrl+N` → `compose`) ; `close` |
| Edit | `role: 'editMenu'` |
| Message | `Reply` (`R`), `Reply All` (`A`), `Forward` (`F`) ; `Archive` (`E`), `Move to Trash` (`Delete`) ; `Snooze` (`H`), `Pin` (`S`), `Mark as Read or Unread` (`U`) |
| View | `Search` (`CmdOrCtrl+F` → `search`), `Command Palette` (`CmdOrCtrl+K` → `palette`), `Sync Now` (→ `sync`) ; `reload`, `togglefullscreen`, `resetZoom`, `zoomIn`, `zoomOut` |
| Window | `role: 'windowMenu'` |

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { APP_COMMANDS, type AppCommand, isAppCommand } from '../src/shared/commands'
import { appMenuTemplate } from '../src/main/menu'

const sent: AppCommand[] = []
const tpl = appMenuTemplate('OpenMail', (c) => sent.push(c))
const items = (xs: any[]): any[] => xs.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? items(i.submenu) : [])])
const custom = items(tpl).filter((i) => typeof i.click === 'function')

it('opens Settings with CmdOrCtrl+, from the app menu', () => {
  const s = tpl[0].submenu.find((i: any) => i.accelerator === 'CmdOrCtrl+,')
  s.click(); assert.equal(sent.at(-1), 'settings')
})
it('reaches every command exactly once', () => {
  sent.length = 0; for (const i of custom) i.click()
  assert.deepEqual([...sent].sort(), [...APP_COMMANDS].sort())
})
it('never registers accelerators itself', () => {
  for (const i of custom) assert.equal(i.registerAccelerator, false, i.label)
})
it('validates command names', () => {
  assert.equal(isAppCommand('reply'), true); assert.equal(isAppCommand('rm -rf'), false)
})
```

- [ ] **Étape 2 : lancer et constater l'échec** — Run : `node scripts/run-tests.mjs menu` — Expected : FAIL, modules introuvables.

- [ ] **Étape 3 : implémenter `commands.ts` et `appMenuTemplate`** selon le tableau.

- [ ] **Étape 4 : relancer** — Expected : PASS.

- [ ] **Étape 5 : brancher le processus principal** : `setupMenu()` utilise `appMenuTemplate(app.name, (c) => send('command', c))` sur macOS (Windows et Linux gardent `Menu.setApplicationMenu(null)`) ; `applyLanguage()` rappelle `setupMenu()` quand la langue change.

- [ ] **Étape 6 : brancher le renderer** : `runCommand` porte la logique aujourd'hui dans le `switch` de `useShortcuts` (`App.tsx`) pour les commandes de la liste ; le `switch` et la palette appellent `runCommand` au lieu de dupliquer. Gardes : commandes « Message » sans rien à faire (`st.targets()` vide ou pas de sélection) → retour silencieux. `settings` → `openSettings('general')`, `sync` → `api.syncNow()`. Le listener `window.openmail.on('command', …)` (`App.tsx:191`) appelle `runCommand(c)` si `isAppCommand(c)`. Ajouter dans `useShortcuts` : `(e.ctrlKey || e.metaKey) && e.key === ','` → `preventDefault()` puis `runCommand('settings')`.

- [ ] **Étape 7 : traductions** — Run : `npm run i18n:check`, ajouter les clés manquantes dans les trois locales en reprenant les termes déjà utilisés par la palette (`Reply`, `Forward`, `Archive`… y sont déjà).

- [ ] **Étape 8 : vérification manuelle sur macOS** : chaque menu s'ouvre, ⌘, ouvre les Réglages, `Message › Reply` sans sélection ne fait rien, `R` dans la liste répond une seule fois, passer l'app en polonais renomme les menus. Sur Windows ou Linux : Ctrl+, ouvre les Réglages.

- [ ] **Étape 9 : point de contrôle.**

---

### Tâche 4 : nom accessible obligatoire pour les boutons-icônes

**Files :**
- Modify : `src/renderer/src/components/ui.tsx` (`IconButton`), les 27 appels de `<IconButton` dans `src/renderer/src`

**Interfaces :**
- Produces : `IconButton` exige `label: string`, rendu en `aria-label={label}` et `title={p.title ?? label}`.

Le compilateur sert de test : il liste chaque appel sans libellé.

- [ ] **Étape 1 : rendre `label` obligatoire** dans les props d'`IconButton`.

- [ ] **Étape 2 : constater l'échec** — Run : `npx tsc --noEmit -p tsconfig.web.json` — Expected : une erreur par appel sans `label` (27).

- [ ] **Étape 3 : ajouter `label={t('…')}`** à chaque appel, en réutilisant le `title` existant quand il y en a un (le supprimer alors, `label` le remplace). Les trois boutons de suppression (`SettingsView.tsx:428`, `:478`, `RulesTab.tsx:179`) prennent `t('Delete signature')`, `t('Delete template')`, `t('Delete rule')`.

- [ ] **Étape 4 : relancer** — Run : `npx tsc --noEmit -p tsconfig.web.json && npm run i18n:check` — Expected : aucune erreur.

- [ ] **Étape 5 : vérification** : avec VoiceOver (macOS) ou l'arbre d'accessibilité des DevTools, la barre d'actions d'une conversation annonce un nom pour chaque bouton.

- [ ] **Étape 6 : point de contrôle.**

## Hors périmètre

`onClick` sur des `div`/`span` (23 cas), `aria-modal` et piège de focus des modales, augmentation du contraste système (`prefers-contrast`), nouvelles captures d'écran (plan « Outillage, documentation et renommage »).
