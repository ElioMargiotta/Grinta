# Refonte planning « piloté par les matchs » — contexte de reprise

> Note de passation pour continuer le travail (ex. avec Codex). Décrit l'objectif,
> le modèle, ce qui est fait, et ce qui reste. Branche : `75-61-calendar-ics-component`.

## Objectif

Avant : le planning d'entraînement (`macro → méso → micro → sessions`) et le
calendrier des matchs (`team_matches`, importé par ICS) étaient **deux systèmes
étanches**. La création de saison via l'ancien wizard (équilibrage manuel des
semaines, contrainte « somme = total ») était peu intuitive.

But : **piloter la saison par les matchs** (modèle « tactical periodization / MD± »)
et **unifier** vue Saison ↔ vue Hebdo. Tout se passe désormais dans `/planner/[teamId]`.

## Modèle (3 couches)

```
COUCHE 1  team_matches            ← ancres (ICS + manuel), is_anchor / kind / home_away
COUCHE 2  microcycles (semaines)  ← portent À LA FOIS mesocycle_id ET target_match_id
COUCHE 3  macro/mésocycles        ← phases : Préparation + Cycles (mésocycles du wizard)
```

Le générateur écrit dans le **même** `macro → méso → micro` que lit la vue Hebdo,
donc une génération apparaît partout (Saison, Hebdo) avec phases + thèmes.

## UI : `/planner/[teamId]` — 3 onglets (vue par défaut = `season`)

- **Saison** : `PlannerSeasonWizard` (assistant) + `PlannerSeasonView` (timeline).
  - Wizard : phase préparatoire (nb semaines avant 1er match → reprise auto + thème
    « phase de jeu ») puis liste de **mésocycles** {durée, thème, nom} → bouton Générer.
- **Hebdomadaire** : `PlannerWeeksGrid` (calendrier mensuel). Affiche les bandeaux de
  phase, la couleur de thème par semaine, les sessions, et un **badge ⚽ par match**.
- **Calendrier** : `TeamCalendarSection` (import ICS, CRUD matchs, réglages de rythme).

Workflow type : Calendrier (importe ICS, coche les ancres, règle les jours
d'entraînement) → Saison (règle prépa + cycles → Générer) → Hebdo (voit tout).

## Fichiers clés

- `src/lib/planner/season.ts` — **logique pure** `planSeason(matches, settings, opts)`.
  Mode auto OU `opts.structure = { prepWeeks, prepTheme, mesos:[{weeks,theme,name}] }`.
  Sortie : `{ macro, phases[] (kind/name/theme/microIndexes), microcycles[] (startDate
  lundi, weekNumber, phaseIndex, targetMatchId, sessions:[{date, mdOffset}]) }`.
  `mdOffset` négatif = jours avant le match (MD-3…), null = semaine sans match.
- `src/app/[locale]/(app)/planner/[teamId]/season-actions.ts` —
  `generateSeasonSkeletonAction(formData)` : lit `structure` (JSON), appelle
  `planSeason`, **idempotent** (supprime macrocycle `source='generated'` → cascade
  méso+micro, + sessions `source='generated'`), recrée macro+méso(phases/cycles)+micro.
  Préserve **format/notes** des semaines par `start_date` ; le **thème** est repiloté
  par le wizard (thème de phase par défaut).
- `src/components/planner/PlannerSeasonWizard.tsx` — l'assistant (style Card de
  `src/components/evaluation/EvaluationsSection.tsx`).
- `src/components/planner/PlannerSeasonView.tsx` — wizard + timeline « vue d'ensemble ».
- `src/components/planner/PlannerCalendar.tsx` — switch d'onglets season/weekly/calendar.
- `src/components/planner/PlannerWeeksGrid.tsx` — grille hebdo (prop `matches` ajouté,
  badge ⚽ dans la cellule). ~1000 lignes, modèle macro/méso/micro.
- `src/components/teams/TeamCalendarSection.tsx`, `.../MatchEditor.tsx`,
  `.../PeriodizationSettingsForm.tsx` — gestion calendrier (rendus dans l'onglet Calendrier).
- `src/app/[locale]/(app)/teams/[teamId]/calendar/{actions,match-actions}.ts` — server
  actions ICS + CRUD matchs + réglages rythme (`team_periodization_settings`).
- i18n : `src/messages/{fr,en,de,it}.json` → `planner.season.*`, `planner.wizard.*`,
  `teams.calendar.match.*`, `teams.calendar.settings.*`. **Toujours mettre les 4 locales.**

## Schéma DB (migrations, toutes poussées en dev le 2026-06-05)

- `team_matches` : + `kind, home_away, opponent, competition, is_anchor, microcycle_id`,
  `source ∈ (subscription|upload|manual)`.
- `team_periodization_settings` : `training_weekdays smallint[]` (ISO 1=lun..7=dim), `md_scheme`.
- `microcycles` : + `team_id` (NOT NULL), `target_match_id`, `kind` ; `mesocycle_id`
  devient **nullable** ; RLS réécrite sur `team_id`.
- `sessions` : + `md_offset smallint`, `source ∈ (manual|generated)`.
- `macrocycles` : + `source ∈ (manual|generated)` (+ index unique partiel : 1 généré/équipe).

## Conventions / pièges

- **Fuseau** : `team_matches.starts_at` est en UTC ; toujours convertir en date civile
  **Europe/Zurich** avant calculs de jours/semaines (helpers `Intl` dans `season.ts`,
  `ics.ts`, `match-actions.ts`).
- **Thèmes** = `THEME_OPTIONS` dans `MicrocycleThemePicker.tsx` (phases de jeu :
  possede_ballon, ne_possede_pas, recupere, perd, recupere_perd, decharge, jeux_polysport).
- **Idempotence** : ne jamais dupliquer ; le générateur supprime+recrée le `generated`.
  Les sessions/macros `manual` ne sont jamais touchées.
- Pas de runner de tests dans le repo → la logique pure de `season.ts` se vérifie via un
  petit script jetable `node --experimental-strip-types scripts/_smoke.ts` (Node 22).
- L'ancien `PlannerSetupWizard.tsx` n'est **plus rendu** (fichier encore présent).

## Vérifier

```bash
npx tsc --noEmit          # doit être à 0
npm run lint              # 3 problèmes PRÉEXISTANTS hors périmètre
                          # (AccountPersonaForm, schemaSettings, PreparationSheet)
npm run dev               # /fr/planner/<teamId>
```

## Modèle « calendrier vivant » (livré, session 2026-06-07)

Remplace l'ancien garde-fou destructif (modal qui supprimait les matchs hors cadre).
Constat : la fédé met à jour le **même lien ICS tour par tour** et la synchro Grinta
fait un **upsert sans delete** (`sync.ts`) → l'historique est déjà préservé côté DB.

- **Archivage auto le jour du match** : `archivePastMatches(supabase, teamId)` dans
  `sync.ts` passe `archived=true` (+`archived_at`) sur les matchs `starts_at < now()`.
  Appelé en tête de `syncTeamCalendar` ET à l'ouverture du planner (`planner/[teamId]/page.tsx`).
- **Détachement de l'ICS** : la synchro exclut de l'upsert les `ics_uid` déjà archivés
  → un match joué reste figé même si la fédé le retire/garde dans le flux.
- **Vues actives** = `archived=false` (planner page, `season-actions` anchors).
  **Historique** = `archived=true` : query dédiée en page, passée via
  `PlannerCalendar → PlannerSeasonView → PlannerSeasonWizard → TeamCalendarSection`
  (prop `archivedMatches`), rendu en section repliable (`ArchivedRow`).
- **Garde-fou non destructif** : plus de modal. Dans le wizard, bouton « Générer »
  désactivé si le tour sélectionné n'a aucun match (`noMatchesForTour`) + bandeau
  ambre `planner.wizard.noMatchesForTour`. Rien n'est supprimé automatiquement.
- Migration : `supabase/migrations/20260607090000_match_archived.sql`
  (`team_matches.archived`, `archived_at`, index `team_matches_archived_idx`).
  **À pousser en dev** (pas encore appliquée).
- i18n : `planner.wizard.noMatchesForTour` + `teams.calendar.history*` (4 locales).
  Anciennes clés `planner.wizard.mismatch.*` supprimées.

## Isolation par saison + archivage saison (livré, session 2026-06-07)

- **Util** `src/lib/planner/seasons.ts` : `currentSeasonLabel`, `seasonWindow(label)`
  (juil. → juin), `seasonStartYear`, `normalizeSeasonLabel`. Pur, serveur + client.
- **Saison active** = `?season=YYYY/YY` (défaut = courant par date). La page planner
  filtre TOUT par la fenêtre du millésime : matchs actifs + archivés, sessions,
  micro/méso/macrocycles (vue Hebdo, conteneurs vides retirés), seasonMicrocycles.
  → la vue Hebdo n'affiche plus que le millésime sélectionné.
- **Sélecteur de saison** global dans `PlannerCalendar` (à côté du switch de vue),
  navigue `?season=&view=`. Les saisons archivées sont marquées `(archivée)`
  (`planner.view.seasonArchived`). `PlannerSeasonView` n'a plus son propre sélecteur
  de saison (gardé seulement le filtre de tour).
- **Auto-archivage** : `generateSeasonSkeletonAction` passe les `season_plans` de
  millésimes ANTÉRIEURS (`season_label < courant`) en `status='archived'`. Liste des
  saisons + statut calculés en page depuis `season_plans`.
- Pas de migration (réutilise `season_plans.status` existant). i18n :
  `planner.view.seasonSelect` / `seasonArchived` (4 locales).

## Refonte wizard « 3 slots + sous-onglets tours + phases » (EN COURS, 2026-06-07)

Décisions validées : (1) **3 vrais abonnements ICS** par slot, (2) bornes de tours
= **coupure date fixe** dans la saison (ajustable), (3) **phases** remplacent les
« cycles » (UI style sections de `PreparationSheet.tsx`).

**FAIT — fondation backend (slots d'abonnement), non-breaking :**
- Migration `20260607100000_calendar_subscription_slots.sql` : `team_calendar_subscriptions`
  + `slot` (first_round|second_round|full), PK passe à **(team_id, slot)**. **À pousser.**
- `sync.ts` : type `SubscriptionSlot`, `SyncInput.slot`, `markSubscriptionResult`
  filtre par slot.
- `calendar/actions.ts` : `parseSlot`, `save/sync/disconnect` slot-aware
  (onConflict `team_id,slot`, filtres `.eq('slot', …)`). Sans champ `slot` → `full`.

**FAIT — palier 2 : 3 slots d'import dans l'UI :**
- Page planner : fetch de TOUS les abonnements (`select slot,...`, plus de `maybeSingle`)
  → `subscriptions[]` passé dans la chaîne page → PlannerCalendar → PlannerSeasonView
  → PlannerSeasonWizard → TeamCalendarSection (toutes les types `Subscription` ont `slot`).
- `TeamCalendarSection` : sous-composant `SubscriptionSlot` (URL + sync + disconnect +
  upload, envoie `slot` dans le FormData) rendu ×3 (first_round/second_round/full) ;
  matchs + historique + périodisation gardés une seule fois. `key` par slot+url.
- i18n `teams.calendar.slot.{first_round,second_round,full}` (4 locales).

**RESTE À FAIRE (UI) :**
3. Vue Saison : **sous-onglets Tour 1 / Tour 2** (bornes fixes ajustables) pour
   planifier séparément, toujours sous la saison.
4. **Phases** : remplacer la liste « cycles » (`mesos`) du `PlannerSeasonWizard` par
   des sections de phase empilées (style `PreparationSheet`), chacune {durée, thème,
   nom}. Le générateur `season.ts` lit déjà `structure.mesos` → mapper phases→mesos.

## Reste à faire (idées)

- Éditeur de **renommage de phase** à la souris dans le planner (aujourd'hui les noms
  viennent du wizard et sont préservés à la régénération, mais pas éditables hors wizard).
- Garde-fou session générée vs manuelle sur le même créneau (même jour/slot).
- Option « date de reprise exacte » dans le wizard (aujourd'hui = nb de semaines).
- Nettoyage final : retrait de `PlannerSetupWizard` + de la contrainte `weekDelta`.
