---
name: grinta-ui
description: Conventions UI de Grinta (tokens sémantiques, primitives src/components/ui, variants CVA, patterns formulaire/modale/liste/état-vide/loader). À utiliser pour TOUTE création ou modification d'interface — nouveau composant, écran, ou ajustement visuel.
---

# Grinta — Conventions UI

Stack : Next 16 / React 19 / Tailwind v4 / shadcn + `@base-ui/react` / CVA / `lucide-react`.
Primitives : `src/components/ui/`. Helper de classes : `cn()` dans `src/lib/utils.ts`
(toujours l'utiliser, ne jamais réintroduire de helper concurrent).

## Règle d'or

1. **Tout pattern répété = un composant** dans `src/components/ui/`. Ne pas copier-coller
   des grappes de classes Tailwind entre features.
2. **Les variations passent par des variants CVA** (`cva()` + `VariantProps`), pas par
   des classes dupliquées au point d'appel.
3. **Couleurs via tokens sémantiques uniquement.** Interdit : `bg-white`, `bg-zinc-*`,
   `text-zinc-*`, `border-zinc-*` bruts. Ils cassent le dark mode (qui repose sur des
   fallbacks fragiles dans `globals.css`, voués à disparaître).
4. **Accessibilité non négociable** : `focus-visible:ring-2 ring-ring` sur tout élément
   interactif, `aria-invalid` sur les champs en erreur, contraste AA.

## Tokens couleur (définis dans `src/app/globals.css`)

| Usage | Token Tailwind | Remplace |
|-------|----------------|----------|
| Fond de page | `bg-background` | `bg-white` page |
| Surface (carte, champ, popover) | `bg-card` / `text-card-foreground` | `bg-white` |
| Surface atténuée | `bg-muted` / `text-muted-foreground` | `bg-zinc-50/100` |
| Couleur d'action (= accent club) | `bg-primary` / `text-primary-foreground` | `bg-black`, `bg-blue-*` |
| Survol neutre | `hover:bg-accent` | `hover:bg-zinc-100` |
| Bordure | `border-border` | `border-zinc-200` |
| Anneau focus | `ring-ring` | — |
| Destructif | `bg-destructive` / `text-destructive` | `bg-red-*` |

`--primary` / `--ring` héritent de l'accent du club (`--club-primary`) — ne jamais
coder une couleur d'action en dur, laisser le token résoudre la teinte du club.
La palette marketing/landing (`--brand`, blobs) est volontairement distincte et hors périmètre.

## Échelle radius (réutiliser, ne pas en créer)

- **Cartes / conteneurs / modales** : `rounded-xl`
- **Champs / boutons** : `rounded-lg`
- **Pills / avatars / pastilles** : `rounded-full`
- **Badges / petits éléments** : `rounded-md`

## Catalogue des primitives

| Primitive | Variants / props | Quand l'utiliser |
|-----------|------------------|------------------|
| `Button` | `variant: primary\|secondary\|ghost\|danger`, `size: sm\|md\|lg\|icon`, `loading` | Toute action. Jamais de `<button>` brut stylé à la main. |
| `Card` (+ `CardHeader/Title/Content/Footer`) | `variant: default\|interactive\|muted`, `padded` | Conteneur de contenu. `interactive` si cliquable. |
| `Section` (+ `SectionHeader`) | `padding: sm\|md` | Bloc de page titré. |
| `Input` / `Textarea` / `Select` | `label`, `error`/`aria-invalid` (style partagé via `fieldVariants`, `field.ts`) | Champs de formulaire. |
| `Dialog` (+ `Trigger/Content/Header/Title/Description/Footer/Close`) | `showClose` | Modale centrée (confirmation, formulaire court). |
| `Sheet` (+ `Trigger/Content/Header/Title/Description/Close`) | `side: right\|left\|bottom` | Panneau coulissant (édition latérale, filtres). |
| `EmptyState` | `icon`, `title`, `description`, `action` | Liste / table / section sans contenu. |
| `Skeleton` | classes de dimension à composer | Chargement d'un bloc. |
| `Badge` | `variant: default\|secondary\|success\|warning\|danger\|outline` | Statut/catégorie non interactif. |
| `Pill` | `active` | Filtre / tag / segment interactif (rendu `<button>`). |
| `Spinner` | `size: xs\|sm\|md\|lg`, `tone` | Indicateur de chargement inline. |
| `LoadingOverlay` | `variant: blocking\|subtle`, `fullscreen` | Surcouche de chargement bloquante. |

Toutes les primitives à variants exposent leur fonction `*Variants` (ex. `buttonVariants`)
pour composer un élément externe avec le même style si nécessaire.

## Patterns récurrents

- **Formulaire** : `Input`/`Textarea`/`Select` (avec `label` + `error`) dans un `<form>`,
  actions en bas via `Button`. Pas de champ stylé à la main.
- **Modale** : `Dialog` pour une boîte centrée, `Sheet` pour un panneau latéral —
  jamais réimplémenter un overlay + backdrop.
- **Liste / table vide** : `EmptyState` (jamais un `<p>` « Aucun résultat » ad-hoc).
- **Chargement** : `Skeleton` pour un placeholder de contenu, `Spinner`/`LoadingOverlay`
  pour une attente.
- **Statut** : `Badge` (libellé), `Pill` (filtre cliquable).

## Anti-checklist avant de committer de l'UI

- [ ] Aucun `bg-white` / `bg-zinc-*` / `text-zinc-*` / `border-zinc-*` ajouté.
- [ ] Aucun `<button>` brut : passer par `Button`/`Pill`.
- [ ] Radius conforme à l'échelle ci-dessus.
- [ ] `focus-visible` présent sur les interactifs.
- [ ] Variation exprimée en variant CVA, pas en classes copiées.

Version humaine détaillée : `docs/ui-conventions.md`.
