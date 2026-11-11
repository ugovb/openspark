# Audit OpenMail — 2026-11-11

Spec des plans `docs/superpowers/plans/2026-11-11-*.md`. Base : branche `om/work` (commit `3a97fe5` + correctif
non commité de `showWindow` dans `src/main/index.ts`). Design évalué avec le skill apple-design
(HIG Apple, 123 pages), sur le code et `docs/screenshots/`, sans lancer l'application.

État mesuré : typecheck propre (deux tsconfig) ; 161 tests passent, 20 annulés faute de GreenMail (Java absent) ;
`npm audit` : 6 vulnérabilités (3 hautes, 3 modérées).

## A. Sécurité et dépendances

- A1. `mdToHtml` (`src/renderer/src/lib/format.ts:81`) n'échappe pas `"` ni `'` puis place l'URL dans `href="…"` :
  une sortie IA influencée par un e-mail peut injecter des attributs (pixel de suivi via `style`). La CSP bloque les scripts.
- A2. Signatures et modèles injectés sans assainissement : `SettingsView.tsx:448`, `Composer.tsx:236` et `:693`.
  La détection « texte ou HTML » (`/<[a-z][\s\S]*>/i`) prend `Ugo <ugo@x.test>` pour du HTML.
- A3. `will-navigate` (`src/main/index.ts:105`) accepte toute URL commençant par `http://localhost` (dont
  `http://localhost.evil.test`) et tout `file://`.
- A4. `sandbox: false` sur les fenêtres (`src/main/index.ts:87`) alors que le preload n'utilise que des API disponibles en sandbox.
- A5. `open-attachment` ouvre n'importe quel fichier (`.exe`, `.app`, `.desktop`…) sans avertissement.
- A6. Dépendances : nodemailer ≤ 10.1.3 (injection SMTP/en-têtes ; mailparser 3.14.3 embarque 10.1.0), zod < 4.6.6,
  Electron < 44.9 (certificats eMudhra), undici, body-parser, qs (transitives). minimatch (electron-builder, dev) reste accepté.

## B. Accessibilité et intégration macOS

- B1. Contrastes sous WCAG AA (`accessibility.md › Color and effects` : 4.5:1 jusqu'à 17 pt) — faint 2.57, accent 3.37,
  blanc sur accent sombre 2.86, warning 2.06, success 2.69, newsletter 2.61, rail-faint 4.13/3.89.
- B2. ~19 textes en 10.5–11 px (`typography.md` : minimum macOS 10 pt ; plancher retenu 11.5 px).
- B3. Corps des e-mails et impression en « Segoe UI » d'abord, même sur macOS.
- B4. Barre de menus macOS sans Fichier, Message, Réglages… (`the-menu-bar.md › App-specific menus`).
- B5. Pas de ⌘, (`settings.md › Desktop (macOS)`).
- B6. Boutons-icônes sans nom accessible (41 `aria-label` pour 122 `<button>`).
- Hors périmètre de cette série : `onClick` sur `div`/`span` (23), modales sans `aria-modal` ni piège de focus,
  sélecteur de thème intégré (gardé pour Windows/Linux).

## C. Outillage, documentation, renommage

- C1. Les tests unitaires ne tournent pas sans GreenMail ; la CI ne teste pas macOS.
- C2. Ni linter ni `noUnusedLocals`.
- C3. Docs périmées : langues (fr, es manquantes), dossiers de données « Octopus Mail », `octo serve`, `OCTO_HOME`,
  capture `desktop.png` à l'ancienne marque.
- C4. Identifiants `octo` restants non persistés : protocole `octo-cid`, cookie `octo_token`, en-tête `X-Octo`,
  classes CSS et animations `octo-*`, évènement `octo-search`, préfixe `octo-print-`, alias `window.octo`, `_octoStopped`.
  Marqueurs persistés dans les mails et brouillons (`octo-quote`, `octo-att`, `octo-signature`, `x-octopus-draft`,
  `octolib`), commande `octo` et variables `OCTO_*` : conservés (migration de format hors périmètre).
