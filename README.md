# Grinta Design System

## What is Grinta?

**Grinta** is a web application for football (soccer) trainers. It helps coaches manage their teams, build an exercise library, and plan their full season — year down to day-level — with a structured calendar. The tagline is *"Plan your football season."*

The product is a single surface: a **Next.js web app** (App Router) backed by Supabase. There is no native mobile app, no marketing site, and no documentation site in the provided source.

## Source

- **GitHub**: `ElioMargiotta/Grinta` (private)  
  — Full-stack Next.js 16 app at repo root
- **No Figma file** was provided.
- **No slide templates** were provided.

---

## Routes & Features

| Route | Description |
|---|---|
| `/login`, `/signup` | Auth screens |
| `/dashboard` | Overview: teams count, exercise count, next session |
| `/teams` | Team list, team detail, player roster |
| `/exercises` | Exercise library (warmup / technical / tactical / physical / cooldown) |
| `/planner` | Season planner — year / month / week / day views via FullCalendar |
| `/planner/[teamId]/sessions/[id]` | Session detail with exercise assignment and printable prep sheet |

---

## CONTENT FUNDAMENTALS

### Tone
Clean, direct, functional. Grinta's copy is terse and professional — written for coaches who are busy and results-oriented. No fluff.

### Voice
- **Second person** ("Log in to plan your team's training.")
- **Sentence case** everywhere — never ALL CAPS or Title Case For Every Word in body copy
- **No emoji** in the UI
- **No exclamation marks** in functional copy
- Errors are plain and human: *"Invalid email or password."* / *"Something went wrong. Try again."*
- Empty states are brief and actionable: *"No teams yet. Create your first one."*

### Specific examples
- *"Plan your football season."* — tagline
- *"Welcome back, {name}."* — dashboard greeting
- *"Set up your account in 30 seconds."* — signup subtitle
- *"No upcoming session."* — empty state
- *"At least 6 characters."* — inline form help, lowercase, no period

### i18n
The app is English-first with French locale support (`fr.json`). Keys are identical; French strings are filled when ready to ship. No code changes needed.

---

## VISUAL FOUNDATIONS

### Color
Entirely **zinc monochrome** — no brand accent color. The palette runs from `#fafafa` (zinc-50) to `#09090b` (zinc-950). The only chromatic color is **red-600** (`#dc2626`) for danger actions and error text.

The site is locked to **light mode** (dark mode prepared but class-gated and never activated).

### Typography
- **Sans**: Geist Sans (variable, from Vercel/Google Fonts)
- **Mono**: Geist Mono (code/technical fields)
- Body text is `text-sm` (14px) throughout the app UI
- Labels are `text-sm font-medium`
- Section headings are `text-lg font-semibold`
- No display type is used

### Spacing
Tailwind default scale. The app is consistently spaced:
- Sidebar: `px-4 py-5` (logo), `px-2` + `gap-1` (nav)
- Topbar: `h-14 px-4`
- Content: `p-4` or `p-6` typical

### Backgrounds & Surfaces
- Page background: `white` (`#ffffff`)
- Sidebar & topbar: `white`
- Border between sections: `border-zinc-200`
- Cards: `white` with `border-zinc-200`, `rounded-lg`
- Inputs: `white` with `border-zinc-300`
- Active nav item: `bg-zinc-100`
- Hover states: `bg-zinc-50` or `bg-zinc-100`

**No gradients, no illustrations, no background images, no textures.**

### Borders & Radius
- **Inputs & buttons**: `rounded-md` (~6px)
- **Cards**: `rounded-lg` (~8px)
- Borders: 1px `zinc-200` (surfaces), `zinc-300` (inputs)

### Shadows
None. Elevation is communicated entirely through borders, not shadows.

### Animation
Tailwind `transition-colors` on interactive elements. No spring/bounce animations, no page transitions, no keyframe animations beyond focus rings.

### Hover / Press States
- Buttons: background darkens one step (e.g. `zinc-900` → `zinc-800`)
- Nav links: `bg-zinc-50` hover, `bg-zinc-100` active
- Ghost buttons: `bg-zinc-100` on hover
- No scale/shrink on press

### Focus
`focus-visible:ring-2 focus-visible:ring-offset-2` on all interactive elements. Ring color matches the element's variant.

### Cards
`rounded-lg border border-zinc-200 bg-white p-4` — flat, no shadow, thin border.

### Iconography
Lucide React (stroke icons, 16×16 `h-4 w-4`). See ICONOGRAPHY section below.

### Imagery
No imagery, no avatars, no illustrations. The UI is text + icon only.

---

## ICONOGRAPHY

Grinta uses **Lucide React** exclusively — `lucide-react` v1.12 installed as an npm dependency.

- **Style**: Stroke (outline), 1.5px stroke weight, 24×24 viewBox
- **Size in UI**: always `h-4 w-4` (16px) inside buttons and nav items
- **No icon font, no SVG sprite, no PNG icons, no emoji**
- Icons are imported individually (tree-shaken): `import { CalendarDays, Dumbbell, LayoutDashboard, Users, LogOut } from "lucide-react"`

### Core icons used

| Context | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Teams | `Users` |
| Exercises | `Dumbbell` |
| Planner | `CalendarDays` |
| Logout | `LogOut` |

**CDN**: For design system preview cards, Lucide is loaded from `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`.

**No brand logos or illustrations were found in the repository** — `public/` contains only Next.js default SVGs. See CAVEATS below.

---

## Files Index

```
README.md                   ← This file
SKILL.md                    ← Agent skill definition
colors_and_type.css         ← CSS custom properties for color + type tokens
assets/                     ← Logos and visual assets
  lucide-note.txt           ← Icon usage note
preview/                    ← Design system card previews (registered in tab)
  colors-brand.html
  colors-neutral.html
  colors-semantic.html
  type-scale.html
  type-specimens.html
  spacing-tokens.html
  spacing-radius.html
  components-buttons.html
  components-inputs.html
  components-cards.html
  components-nav.html
  components-badges.html
ui_kits/
  web-app/
    README.md
    index.html              ← Interactive click-thru prototype
    Sidebar.jsx
    Topbar.jsx
    Dashboard.jsx
    Teams.jsx
    Exercises.jsx
    Planner.jsx
    Auth.jsx
```

---

## CAVEATS

- **No brand logo** was found in the repository (`public/` only has Next.js placeholder SVGs). The wordmark "Grinta" is rendered in text only (`text-lg font-semibold`). Ask the team for an SVG logo.
- **No Figma** was provided — design system is derived entirely from source code.
- **Geist fonts** are loaded from Google Fonts CDN in preview cards (the repo loads them via `next/font`).
- The app intentionally has **no accent/brand color** — everything is zinc + red-danger. This may be a deliberate MVP choice.
