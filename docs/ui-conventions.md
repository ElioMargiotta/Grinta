# Conventions UI Grinta

> Document de référence pour les contributeurs. La version « source » consommée par
> l'assistant IA est le skill `.claude/skills/grinta-ui/SKILL.md` — garder les deux
> alignés. Le plan d'homogénéisation global est dans `uiPlan.md`.

## Pourquoi

L'UI avait divergé : les primitives partagées (`Button`, `Card`, `Input`…) coexistaient
avec des dizaines de composants par feature dupliquant des classes Tailwind « volantes »,
d'où des incohérences d'espacements, radius, ombres, couleurs et dark mode. Ces
conventions figent un socle unique pour éviter la dérive.

## Principes

1. **Tout pattern répété devient un composant** dans `src/components/ui/`.
2. **Les variations passent par des variants CVA** (`cva()` + `VariantProps`), jamais par
   des classes copiées au point d'appel.
3. **Couleurs via tokens sémantiques** — pas de `bg-white` / `bg-zinc-*` bruts.
4. **Accessibilité** : focus visible, `aria-invalid`, contraste AA.

Helper unique pour fusionner les classes : `cn()` (`src/lib/utils.ts`), qui combine
`clsx` + `tailwind-merge`.

## Tokens couleur

Définis dans `src/app/globals.css` (`@theme inline` + `:root`). Utiliser les classes
Tailwind sémantiques correspondantes :

| Intention | Classe | À la place de |
|-----------|--------|---------------|
| Fond de page | `bg-background` | `bg-white` |
| Surface (carte, champ, popover) | `bg-card`, `text-card-foreground` | `bg-white` |
| Surface atténuée | `bg-muted`, `text-muted-foreground` | `bg-zinc-50/100`, `text-zinc-500` |
| Action principale | `bg-primary`, `text-primary-foreground` | `bg-black`, `bg-blue-600` |
| Survol neutre | `hover:bg-accent` | `hover:bg-zinc-100` |
| Bordure | `border-border` | `border-zinc-200` |
| Focus | `ring-ring` | — |
| Destructif | `bg-destructive`, `text-destructive` | `bg-red-600` |

`--primary`, `--ring`, `--accent`, `--border` héritent de l'accent du club courant
(`--club-primary`, `--club-line`). En laissant le token résoudre, chaque club obtient
automatiquement sa teinte. La palette **marketing/landing** (`--brand`, blobs animés)
est volontairement séparée et n'est pas concernée par ces tokens.

### Dark mode

Le dark mode cible repose sur les tokens. Des **fallbacks transitoires** existent dans
`globals.css` (`.dark .bg-white:not(...)`, etc.) pour les écrans non encore migrés ; ils
seront retirés au fil des migrations de features. **Ne pas ajouter** de nouvelles classes
`bg-white`/`bg-zinc-*` qui dépendraient de ces fallbacks.

## Échelle radius

Le système `--radius-*` (dérivé de `--radius`) existe déjà dans `globals.css` — le
réutiliser, ne pas créer de nouveaux tokens. Règles d'usage :

| Élément | Radius |
|---------|--------|
| Carte / conteneur / modale / sheet | `rounded-xl` |
| Champ / bouton | `rounded-lg` |
| Pill / avatar / pastille ronde | `rounded-full` |
| Badge / petit élément | `rounded-md` |

## Catalogue des primitives

Toutes dans `src/components/ui/`. Celles à variants exportent aussi leur fonction
`*Variants` (`buttonVariants`, `cardVariants`, `badgeVariants`, `pillVariants`,
`fieldVariants`, …) pour composition externe.

- **`Button`** — `variant: primary | secondary | ghost | danger`, `size: sm | md | lg | icon`,
  `loading`, `loadingLabel`. Toute action interactive. Ne jamais styler un `<button>` brut.
- **`Card`** (+ `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`) — `variant: default |
  interactive | muted`, `padded`. Conteneur de contenu ; `interactive` pour une carte cliquable.
- **`Section`** (+ `SectionHeader`) — `padding: sm | md`. Bloc de page titré.
- **`Input` / `Textarea` / `Select`** — prop `label`, gestion d'erreur via `aria-invalid`.
  Style commun factorisé dans `field.ts` (`fieldVariants`).
- **`Dialog`** (+ `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
  `DialogDescription`, `DialogFooter`, `DialogClose`) — modale centrée, sur `@base-ui/react`.
- **`Sheet`** (+ `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetTitle`,
  `SheetDescription`, `SheetClose`) — panneau coulissant, `side: right | left | bottom`.
- **`EmptyState`** — `icon`, `title`, `description`, `action`. État vide d'une liste/section.
- **`Skeleton`** — placeholder de chargement ; composer les dimensions via classes.
- **`Badge`** — `variant: default | secondary | success | warning | danger | outline`.
  Statut/catégorie non interactif.
- **`Pill`** — `active`. Filtre/tag/segment interactif (rendu `<button>`).
- **`Spinner`** — `size: xs | sm | md | lg`, `tone`. Loader inline.
- **`LoadingOverlay`** — `variant: blocking | subtle`, `fullscreen`. Surcouche de chargement.

## Patterns

- **Formulaire** : `Input`/`Textarea`/`Select` avec `label` + `error`, boutons d'action via `Button`.
- **Modale / panneau** : `Dialog` (centré) ou `Sheet` (latéral) — jamais réimplémenter overlay + backdrop.
- **Liste vide** : `EmptyState`.
- **Chargement** : `Skeleton` (contenu), `Spinner`/`LoadingOverlay` (attente).
- **Statut** : `Badge` (libellé) ou `Pill` (filtre cliquable).

## Checklist de revue UI

- [ ] Aucun `bg-white` / `bg-zinc-*` / `text-zinc-*` / `border-zinc-*` ajouté.
- [ ] Aucun `<button>` brut (utiliser `Button` / `Pill`).
- [ ] Radius conforme à l'échelle.
- [ ] `focus-visible` sur tous les interactifs, `aria-invalid` sur les champs en erreur.
- [ ] Variation via variant CVA, pas de classes dupliquées.
