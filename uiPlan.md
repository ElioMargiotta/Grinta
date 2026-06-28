# Plan — Homogénéisation UI/UX (Issue #109)

## Contexte

L'interface de Grinta a divergé : les primitives partagées (`Button`, `Card`,
`Input`…) coexistent avec des dizaines de composants par feature qui dupliquent
des classes Tailwind « volantes », d'où des incohérences d'espacements, radius,
ombres, couleurs et états. L'objectif (issue #109) est **qualitatif** : rendre
l'UI propre, cohérente et moderne, sans régression fonctionnelle, et **créer un
skill** qui fige les conventions pour éviter la dérive future.

État réel constaté (audit chiffré) :

- **CVA est installé mais inutilisé** dans `src/components/ui/` : `Button`
  gère ses variantes via des `Record<Variant, string>` maison ; les autres
  primitives n'ont aucune variante structurée.
- **Tokens sémantiques contournés massivement** : `bg-white` (289×),
  `bg-zinc-*` (~700×), au lieu de `bg-card` / `bg-muted` / `bg-background`.
  Le dark mode repose sur des fallbacks fragiles dans `globals.css`
  (sélecteurs `.dark .bg-white:not([class*="dark:bg-"])`…).
- **58 `<button>` bruts** hors `ui/`, **69 cartes ad-hoc**
  (`rounded-xl border …` réécrits à la main).
- **Radius incohérents** : `rounded-md` (200×), `rounded-lg` (147×),
  `rounded-xl` (37×), `rounded-2xl` (28×) mélangés sans règle.
- **Aucune primitive Dialog/Sheet/EmptyState/Skeleton** : chaque feature
  réimplémente ses modales (ex. `evaluation/EvaluationSheet`, `planner/MatchHub`,
  `teams/SeasonImportWizard`).
- **`.claude/skills/` est vide** : aucun skill UI n'existe.

Stack : Next 16 / React 19 / Tailwind v4 / shadcn + `@base-ui/react` / CVA /
`lucide-react`. Primitives dans `src/components/ui/`, métier dans
`src/components/<feature>/` (planner=30 fichiers, contingent=13, layout=11,
teams/auth=9, admin=8…).

**Décisions de cadrage validées avec l'utilisateur :**
1. **Stratégie phasée + skill d'abord** : livrer fondations (tokens, primitives
   CVA, skill, doc) puis migrer feature par feature en PR séparées.
2. **Migration vers tokens sémantiques** : remplacer `bg-white`/`bg-zinc-*` par
   les tokens et retirer progressivement les fallbacks dark hacky de
   `globals.css`.

---

## Phase 0 — Mise en place (contexte + livrable plan)

- Copier le contexte graphify depuis l'autre worktree pour analyse locale :
  `cp -r ../Grinta/graphify-out ./graphify-out` (artefact local, **à ajouter au
  `.gitignore`**, ne pas committer — c'est un graphe de dépendances de 1,9 Mo).
- Créer **`uiPlan.md`** à la racine du repo avec le contenu de ce plan (livrable
  demandé, suivi du chantier).

## Phase 1 — Fondations (1 PR « foundations »)

Objectif : socle homogène + skill, **sans toucher aux features** (zéro
régression visible).

### 1.1 Consolider les design tokens — `src/app/globals.css`
- Auditer et documenter les tokens existants (`--radius-*`, couleurs sémantiques
  shadcn déjà mappées L9-55). Le système de radius dérivé existe déjà
  (`--radius-sm`…`--radius-4xl`) — **le réutiliser**, ne pas en créer d'autres.
- Définir une **échelle de spacing/radius de référence** (ex. cartes = `rounded-xl`,
  inputs/boutons = `rounded-lg`, pills = `rounded-full`) et la consigner dans le
  skill (pas de nouveau token nécessaire, on standardise l'usage).
- Préparer la suppression future des fallbacks dark `bg-white/bg-zinc`
  (L124-151) — non supprimés en Phase 1, retirés au fil des migrations features.

### 1.2 Refondre les primitives via CVA — `src/components/ui/`
Réécrire chaque primitive avec `cva()` + `VariantProps`, en conservant l'API
publique (props `variant`/`size`) pour ne pas casser les usages existants :
- **`Button.tsx`** : migrer les `Record<>` (L18-30) vers `cva`. Conserver
  variants `primary|secondary|ghost|danger`, sizes `sm|md` (+ ajouter `icon`/`lg`
  si récurrent dans l'audit des 58 boutons bruts).
- **`Card.tsx`** : ajouter variants (`default`, `interactive`/hover, `muted`) +
  sous-composants optionnels `CardHeader/CardTitle/CardContent/CardFooter` pour
  remplacer les 69 cartes ad-hoc.
- **`Input.tsx`, `Textarea.tsx`, `Select.tsx`** : factoriser le style de champ
  commun (hauteur, radius, focus-ring, état `error`/`aria-invalid`) dans une base
  CVA partagée (`fieldVariants`) réutilisée par les trois.
- **`Section.tsx`, `Spinner.tsx`, `LoadingOverlay.tsx`** : harmoniser variants/tailles.
- Créer les primitives manquantes récurrentes :
  - **`Dialog.tsx` / `Sheet.tsx`** (sur `@base-ui/react`) — base commune pour les
    modales aujourd'hui dupliquées.
  - **`EmptyState.tsx`** (icône + titre + description + action).
  - **`Skeleton.tsx`** (états de chargement homogènes).
  - **`Badge.tsx` / `Pill.tsx`** si l'audit confirme la répétition (`rounded-full`
    117×).
- Centraliser les patterns CVA dans `src/lib/utils.ts` (`cn` existe déjà — le
  réutiliser) ; ne pas réintroduire de helper concurrent.

### 1.3 Créer le skill UI — `.claude/skills/grinta-ui/SKILL.md`
Skill qui référence **chaque convention** pour guider les développements futurs :
- Tokens (couleurs sémantiques, échelle radius/spacing, ombres autorisées).
- Catalogue des primitives + leurs variants (API, quand les utiliser).
- Règles : « tout pattern répété = composant », « variations via variants CVA, pas
  de classes copiées », interdiction des `bg-white`/`bg-zinc-*` bruts (utiliser
  tokens), focus visible & contrastes obligatoires.
- Patterns récurrents : formulaire, modale/sheet, table/liste, état vide, loader.
- Frontmatter `name`/`description` pour déclenchement auto sur tâches UI.

### 1.4 Documentation — `docs/ui-conventions.md` (ou section CLAUDE.md)
Version humaine condensée du skill (le skill = source pour l'IA, le doc = pour
les contributeurs). Lier les deux.

## Phases 2..n — Migration des features (1 PR par lot)

Pour chaque lot, remplacer les composants ad-hoc par les primitives et les
classes brutes par les tokens, puis retirer les fallbacks dark devenus inutiles.
Ordre proposé par impact/risque :

1. **Lot A — layout + dashboard + account/settings** (transverse, fort impact
   visuel, peu de logique).
2. **Lot B — auth + onboarding** (formulaires → primitives `Input`/`Button`/`Card`).
3. **Lot C — teams + contingent** (tables/listes, wizards → `Dialog`/`Sheet`,
   `EmptyState`).
4. **Lot D — planner** (le plus gros, 30 fichiers : modales `MatchHub`,
   `SystemEditor` → primitives).
5. **Lot E — player + evaluation + physical + exercises + sheet** (en gardant la
   logique print de `sheet/`/`prep-*` intacte, hors périmètre tokens).
6. **Landing/marketing** : conserver sa palette propre (`--brand`, blobs, snake) —
   non migré vers tokens app.

Chaque lot : migration → vérif visuelle → suppression des classes mortes →
mise à jour du skill si un nouveau pattern émerge.

---

## Fichiers critiques

- `src/app/globals.css` — tokens, radius, fallbacks dark à dégraisser.
- `src/components/ui/*.tsx` — primitives à refondre en CVA (+ nouvelles).
- `src/lib/utils.ts` — `cn` (réutiliser, ne pas dupliquer).
- `.claude/skills/grinta-ui/SKILL.md` — **nouveau**, livrable clé de l'issue.
- `uiPlan.md` (racine) — **nouveau**, suivi du chantier.
- Features par lot : `src/components/{layout,dashboard,auth,teams,contingent,planner,…}/`.

## Vérification

- **Build/lint/types** : `npm run build` + lint à chaque PR (zéro régression de
  compilation, API des primitives préservée).
- **Visuel** : lancer l'app (`npm run dev`) et comparer avant/après sur les écrans
  clés (dashboard, planner, teams, auth) ; optionnellement captures via Playwright
  MCP sur les routes principales.
- **Anti-régression de classes brutes** : un grep doit montrer la **décroissance**
  de `bg-white`/`bg-zinc-*`/`<button` bruts à chaque lot
  (`grep -rc "bg-zinc-" src` comme métrique de progression).
- **Accessibilité** : focus-visible présent sur tous les interactifs, contrastes
  AA, `aria-invalid` sur champs en erreur (déjà dans `Input`, à généraliser).
- **Dark mode** : vérifier qu'aucun écran migré ne casse une fois le fallback
  `globals.css` retiré pour ce périmètre.

## Notes
- `graphify-out/` reste un artefact local (gitignore), utilisé seulement pour
  cartographier les dépendances avant chaque migration de feature.
- Le skill est volontairement livré en Phase 1 : il sert de garde-fou pour toutes
  les migrations suivantes (et les futurs développements).
