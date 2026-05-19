# 🎬 Trailer Grinta — 30 s

Pipeline pour produire la bande-annonce produit.

## 1. Storyboard (30 s)

| #   | Temps   | Écran                                  | Texte écran                          | Voix off                                                       |
| --- | ------- | -------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| 1   | 0–4 s   | Logo / hero landing                    | « Un club. Une identité. Une méthode » | Planifier une saison de foot, c'est le chaos.                  |
| 2   | 4–9 s   | `/settings/club` + `/teams`            | Tout ton club, un seul espace        | De la pré-formation à l'équipe première : une seule méthode.   |
| 3   | 9–14 s  | `/planner/[team]` (calendrier)         | La saison en 90 secondes             | 3 dates. Grinta ancre le macrocycle et numérote les semaines.  |
| 4   | 14–19 s | `/planner/[team]/sessions/new`         | Construis ta séance                  | Crée la séance du mardi soir, bloc par bloc.                   |
| 5   | 19–24 s | `/exercises` (bibliothèque ASF)        | Bibliothèque ASF intégrée            | Importe un exercice ASF, ou dessine le tien.                  |
| 6   | 24–28 s | `…/sessions/[id]/preparation`          | Fiche prête pour le terrain          | Un PDF A4 officiel, exploitable sur le terrain.               |
| 7   | 28–30 s | Logo + CTA                             | grintaclub.app — Démarre ta saison   | Grinta. Gratuit pour un coach.                                 |

Voix off totale ≈ 70 mots. Musique montante, coupes toutes les ~4 s, zoom léger
(Ken Burns) sur chaque écran. Le PDF qui apparaît à 28 s = le moment fort.

## 2. Capture automatisée des écrans

Tourne **sur la prod** (`https://grintaclub.app`) avec les vraies données de
démo (club **Xamax Academy**, équipe « Actif », saison configurée, séance
« Verticaliser » du 14 mai entièrement préparée).

```bash
# une seule fois
npm i -D playwright
npx playwright install chromium

# enregistrer le trailer
GRINTA_EMAIL=toi@club.app GRINTA_PASSWORD=motdepasse node scripts/trailer/record.mjs
```

Le script : login → bascule sur Xamax → identité club → équipes → planning de
saison → clic sur la tuile « Verticaliser » du calendrier → parcours du
constructeur de séance guidé → étape **Revue & export** (la fiche PDF) →
bibliothèque d'exercices ASF. **Lecture seule** : il ne clique jamais
« Enregistrer » / « Annuler la séance ».

La vidéo brute (.webm 1920×1080, retina) atterrit dans `scripts/trailer/out/`.

Variables optionnelles : `BASE_URL` (def. `https://grintaclub.app`),
`GRINTA_CLUB` (def. `Xamax`), `GRINTA_TEAM_ID`, `GRINTA_SESSION_TEXT`
(def. `Verticaliser`), `GRINTA_LOCALE` (def. `fr`).

> `probe.mjs` (local) et `probe-prod.mjs` (prod) prennent juste des captures
> PNG des écrans clés — pratique pour vérifier le footage avant de monter.

## 3. Montage

1. Importer le `.webm` dans **Screen Studio** (Mac, idéal SaaS), **CapCut** (gratuit) ou **DaVinci Resolve**.
2. Découper / accélérer pour tenir 30 s en suivant le tableau ci-dessus.
3. Ajouter les textes à l'écran + la voix off.
4. Musique libre de droits (Uppbeat, Artlist).
5. Exporter 1080p **horizontal** (LinkedIn/X) et **vertical 9:16** (Insta/TikTok).
