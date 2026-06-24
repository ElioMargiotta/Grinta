import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/getUser";

// Exercise libraries seeded from different PDFs.
// `phases` = clubcorner_2026 (tactical phases of play)
// `gestes` = asf_te_2026     (technical-gesture booklets, Base TE)
// `co`     = asf_co_2026     (physical conditioning booklets, Base CO)
type LibraryFamily = "phases" | "gestes" | "co";

const PHASE_THEMES = [
  "Mon équipe possède le ballon",
  "Mon équipe perd le ballon",
  "Mon équipe ne possède pas le ballon",
  "Mon équipe récupère le ballon",
] as const;

const GESTE_THEMES = [
  "Passe et prise de balle",
  "Conduite du ballon et dribble",
  "Tir au but",
  "Techniques aériennes",
] as const;

const CO_THEMES = ["Explosivité", "Stabilité corporelle"] as const;

const PHASE_TRACKS = ["Base TA", "Développement TA", "Stratégie Team"] as const;
// CO tracks depend on the selected theme. When no theme is active we show
// the union so users see what's available without committing to a theme.
const CO_TRACKS_BY_THEME: Record<string, readonly string[]> = {
  Explosivité: ["Accélérations", "Changements de direction", "Sauts"],
  "Stabilité corporelle": [
    "Coordination et TE",
    "Coordination et TE en salle",
    "Duels",
  ],
};
const CO_TRACKS_ALL = [
  ...CO_TRACKS_BY_THEME["Explosivité"],
  ...CO_TRACKS_BY_THEME["Stabilité corporelle"],
] as const;
const PHASE_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const GESTE_LEVELS = [1, 2, 3] as const;
const CO_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

type Family = "PE" | "TA" | "AT" | "TE";
type FamilyItem = { id: Family; label: string; column: "forme_physique" | "tactique" | "mentalite" | "technique" };

type ExerciseRow = {
  id: string;
  code: string | null;
  titre: string | null;
  name: string;
  theme: string | null;
  track: string | null;
  level: number | null;
  niveau: string | null;
  duree: string | null;
  description: string | null;
  duration_minutes: number | null;
  forme_physique: string[] | null;
  tactique: string[] | null;
  mentalite: string[] | null;
  technique: string[] | null;
  main_image: string | null;
};

type SearchParams = {
  family?: string;
  theme?: string;
  track?: string;
  level?: string;
  focus?: string;
};

function chipStyle(active: boolean) {
  return `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
    active
      ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
  }`;
}

function chipHref(current: SearchParams, key: keyof SearchParams, value: string | null) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v && k !== key) next[k] = v;
  }
  if (value !== null) next[key] = value;
  const qs = new URLSearchParams(next).toString();
  return qs ? `/exercises?${qs}` : "/exercises";
}

// Switching family resets the family-specific filters (theme/track/level)
// since their domains differ. Focus coaching survives — it's family-agnostic.
function familyHref(current: SearchParams, family: LibraryFamily) {
  const next: Record<string, string> = { family };
  if (current.focus) next.focus = current.focus;
  return `/exercises?${new URLSearchParams(next).toString()}`;
}

export default async function ExercisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("exercises");
  const tl = await getTranslations("libraries");
  const { supabase } = await requireUser(locale);

  const libraryTabs: { id: LibraryFamily; label: string; source: string; hint: string }[] = [
    { id: "phases", label: t("page.phasesTab"), source: "clubcorner_2026", hint: t("page.phasesTabHint") },
    { id: "gestes", label: t("page.gesturesTab"), source: "asf_te_2026", hint: t("page.gesturesTabHint") },
    { id: "co", label: t("page.coTab"), source: "asf_co_2026", hint: t("page.coTabHint") },
  ];

  const activeTab =
    libraryTabs.find((tab) => tab.id === sp.family) ?? libraryTabs[0];
  const themes =
    activeTab.id === "phases"
      ? PHASE_THEMES
      : activeTab.id === "co"
        ? CO_THEMES
        : GESTE_THEMES;
  const levels =
    activeTab.id === "phases"
      ? PHASE_LEVELS
      : activeTab.id === "co"
        ? CO_LEVELS
        : GESTE_LEVELS;
  const tracks: readonly string[] | null =
    activeTab.id === "phases"
      ? PHASE_TRACKS
      : activeTab.id === "co"
        ? sp.theme && CO_TRACKS_BY_THEME[sp.theme]
          ? CO_TRACKS_BY_THEME[sp.theme]
          : CO_TRACKS_ALL
        : null;
  const showTracks = tracks !== null;

  let query = supabase
    .from("exercises")
    .select(
      "id, code, titre, name, theme, track, level, niveau, duree, description, duration_minutes, forme_physique, tactique, mentalite, technique, main_image",
    )
    .eq("source", activeTab.source)
    .order("theme", { ascending: true, nullsFirst: false })
    .order("track", { ascending: true, nullsFirst: false })
    .order("level", { ascending: true, nullsFirst: false });

  if (sp.theme) query = query.eq("theme", sp.theme);
  if (sp.track && showTracks) query = query.eq("track", sp.track);
  if (sp.level) query = query.eq("level", Number(sp.level));

  const { data } = await query;
  const exercises = (data ?? []) as ExerciseRow[];

  const families: FamilyItem[] = [
    { id: "PE" as Family, label: tl("families.PE"), column: "forme_physique" as const },
    { id: "TA" as Family, label: tl("families.TA"), column: "tactique" as const },
    { id: "AT" as Family, label: tl("families.AT"), column: "mentalite" as const },
    { id: "TE" as Family, label: tl("families.TE"), column: "technique" as const },
  ];

  const focus = (sp.focus as Family | undefined) ?? null;
  const focusFamily = families.find((f) => f.id === focus) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{activeTab.hint}.</p>
        </div>
        <Link href="/exercises/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      {/* Family tabs — switch between the two seeded libraries. */}
      <div className="flex w-fit gap-1 rounded-[10px] bg-zinc-100 p-1 dark:bg-zinc-900">
        {libraryTabs.map((tab) => {
          const isActive = activeTab.id === tab.id;
          return (
            <Link
              key={tab.id}
              href={familyHref(sp, tab.id)}
              className={`rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition ${
                isActive
                  ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.1)] dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <FilterRow label={activeTab.id === "phases" ? t("filters.phaseOfPlay") : t("filters.theme")}>
          <Link href={chipHref(sp, "theme", null)} className={chipStyle(!sp.theme)}>
            {t("filters.all")}
          </Link>
          {themes.map((t) => (
            <Link key={t} href={chipHref(sp, "theme", t)} className={chipStyle(sp.theme === t)}>
              {t}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label={t("filters.level")}>
          {showTracks && tracks && (
            <>
              <Link href={chipHref(sp, "track", null)} className={chipStyle(!sp.track)}>
                {t("filters.allTracks")}
              </Link>
              {tracks.map((t) => (
                <Link key={t} href={chipHref(sp, "track", t)} className={chipStyle(sp.track === t)}>
                  {t}
                </Link>
              ))}
              <span className="mx-2 h-4 w-px self-center bg-zinc-200" />
            </>
          )}
          <Link href={chipHref(sp, "level", null)} className={chipStyle(!sp.level)}>
            {t("filters.all")}
          </Link>
          {levels.map((n) => (
            <Link
              key={n}
              href={chipHref(sp, "level", String(n))}
              className={chipStyle(sp.level === String(n))}
            >
              {n}
            </Link>
          ))}
        </FilterRow>

        <FilterRow label={t("filters.focusCoaching")}>
          <Link href={chipHref(sp, "focus", null)} className={chipStyle(!focus)}>
            {t("filters.all")}
          </Link>
          {families.map((f) => (
            <Link key={f.id} href={chipHref(sp, "focus", f.id)} className={chipStyle(focus === f.id)}>
              <span className="mr-1 font-mono text-[10px] tabular-nums opacity-70">{f.id}</span>
              {f.label}
            </Link>
          ))}
        </FilterRow>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {t("filters.noMatch")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} focusFamily={focusFamily} noDiagramLabel={tl("noDiagram")} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function ExerciseCard({
  ex,
  focusFamily,
  noDiagramLabel,
}: {
  ex: ExerciseRow;
  focusFamily: FamilyItem | null;
  noDiagramLabel: string;
}) {
  const titre = ex.titre ?? ex.name;
  const focusTags = focusFamily ? (ex[focusFamily.column] ?? []) : null;
  const previewTags = focusTags && focusTags.length > 0
    ? focusTags
    : [
        ...(ex.forme_physique ?? []).slice(0, 1),
        ...(ex.tactique ?? []).slice(0, 1),
        ...(ex.mentalite ?? []).slice(0, 1),
        ...(ex.technique ?? []).slice(0, 1),
      ];

  return (
    <Link
      href={`/exercises/${ex.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {ex.main_image ? (
        <div className="relative aspect-[4/3] w-full bg-zinc-100">
          <Image
            src={ex.main_image}
            alt={titre}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
          {noDiagramLabel}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {ex.theme && (
              <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {ex.theme}
              </div>
            )}
            <div className="mt-0.5 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {titre}
            </div>
          </div>
          {ex.duree && (
            <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {ex.duree}
            </span>
          )}
        </div>

        {ex.niveau && (
          <div className="text-[11px] text-zinc-500">{ex.niveau}</div>
        )}

        {ex.description && (
          <p className="line-clamp-2 text-[12px] leading-snug text-zinc-600 dark:text-zinc-300">
            {ex.description}
          </p>
        )}

        {previewTags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {previewTags.slice(0, focusFamily ? 5 : 4).map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="inline-flex max-w-[180px] items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                title={t}
              >
                <span className="truncate">{t}</span>
              </span>
            ))}
            {focusFamily && focusTags && focusTags.length > 5 && (
              <span className="text-[10px] text-zinc-400">+{focusTags.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
