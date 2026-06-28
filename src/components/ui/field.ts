import { cva, type VariantProps } from "class-variance-authority";

/**
 * Style de champ partagé par Input / Textarea / Select.
 *
 * Standard radius homogénéisé : tous les champs sont en `rounded-lg`
 * (cf. docs/ui-conventions.md). La hauteur et le padding restent gérés
 * par chaque primitive (un input n'a pas la même forme qu'un textarea),
 * mais bordure, fond, focus-ring et état d'erreur sont factorisés ici.
 *
 * L'état d'erreur se pilote via la prop `invalid` (et `aria-invalid` côté DOM).
 */
export const fieldVariants = cva(
  "w-full rounded-lg border bg-card text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2",
  {
    variants: {
      invalid: {
        true: "border-destructive focus:border-destructive focus:ring-destructive/15",
        false:
          "border-border hover:border-input focus:border-ring focus:ring-ring/15",
      },
    },
    defaultVariants: { invalid: false },
  },
);

export type FieldVariants = VariantProps<typeof fieldVariants>;
