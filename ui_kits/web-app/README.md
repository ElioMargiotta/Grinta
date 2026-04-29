# Grinta Web App — UI Kit

Interactive click-through prototype of the Grinta web app.

## Screens
- **Auth** — Log in / Sign up / Check email
- **Dashboard** — Stat cards + recent sessions
- **Teams** — Team list → Team detail → Player roster + Add player form
- **Exercises** — Library with search + category filter → Exercise detail → New exercise form
- **Planner** — Month calendar with session events → Session detail

## Stack
React 18 + Babel (inline), Geist fonts from Google Fonts, Lucide icons (inline SVG paths).

## Components
| File | Contents |
|---|---|
| `Icons.jsx` | `Icon` component + SVG path data for all used icons |
| `Primitives.jsx` | `Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge` |
| `Layout.jsx` | `AppShell`, `Sidebar`, `Topbar` |
| `Dashboard.jsx` | Dashboard screen |
| `Teams.jsx` | Teams list, team detail, player roster |
| `Exercises.jsx` | Exercise library, detail, new form |
| `Planner.jsx` | Month calendar, session detail |
| `Auth.jsx` | Login, signup, check-email screens |
| `index.html` | Entry point — wires all screens together |

## Design tokens used
- Colors: zinc scale (#fafafa–#09090b), danger red-600 (#dc2626)
- Fonts: Geist Sans 400/500/600, Geist Mono 400
- Radii: 6px (buttons/inputs), 8px (cards)
- Elevation: border-only (no box-shadow)
- Icons: Lucide stroke, 16px
