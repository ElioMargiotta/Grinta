"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export type ExerciseLibrary = {
  id: string;
  code: string | null;
  titre: string | null;
  name: string;
  theme: string | null;
  niveau: string | null;
  track: string | null;
  level: number | null;
  duree: string | null;
  description: string | null;
  organisation: string | null;
  forme_physique: string[] | null;
  tactique: string[] | null;
  mentalite: string[] | null;
  technique: string[] | null;
  variation_less_text: string | null;
  variation_more_text: string | null;
  main_image: string | null;
};

type Family = "PE" | "TA" | "AT" | "TE";

const FAMILY_IDS: { id: Family; column: keyof Pick<ExerciseLibrary, "forme_physique" | "tactique" | "mentalite" | "technique"> }[] = [
  { id: "PE", column: "forme_physique" },
  { id: "TA", column: "tactique" },
  { id: "AT", column: "mentalite" },
  { id: "TE", column: "technique" },
];

export function ExerciseLibraryView({ ex }: { ex: ExerciseLibrary }) {
  const [activeFamily, setActiveFamily] = useState<Family>("TE");
  const titre = ex.titre ?? ex.name;
  const t = useTranslations("libraries");
  const active = FAMILY_IDS.find((f) => f.id === activeFamily) ?? FAMILY_IDS[0];
  const activeTags = ex[active.column] ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        {ex.theme && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            {ex.theme}
          </div>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {titre}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          {ex.niveau && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
              {ex.niveau}
            </span>
          )}
          {ex.duree && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
              {ex.duree}
            </span>
          )}
          {ex.code && (
            <span className="font-mono text-[11px] text-zinc-400">{ex.code}</span>
          )}
        </div>
      </div>

      {/* Two-column layout: image + organisation */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        {ex.main_image ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm">
            <Image
              src={ex.main_image}
              alt={titre}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-400 shadow-sm">
            {t("noDiagram")}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {ex.description && (
            <Section title={t("description")}>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">
                {ex.description}
              </p>
            </Section>
          )}
          {ex.organisation && (
            <Section title={t("organisation")}>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">
                {ex.organisation}
              </p>
            </Section>
          )}
        </div>
      </div>

      {/* Coaching tabs */}
      <Section title={t("coachingPoints")}>
        <div className="flex flex-wrap gap-1 rounded-[10px] bg-zinc-100 p-1">
          {FAMILY_IDS.map((f) => {
            const count = (ex[f.column] ?? []).length;
            const isActive = activeFamily === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFamily(f.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-medium transition ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {f.id}
                </span>
                <span>{t(`families.${f.id}`)}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                    isActive ? "bg-zinc-100 text-zinc-700" : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] text-zinc-400">{t(`familyHints.${active.id}`)}</div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {activeTags.length === 0 ? (
            <li className="text-[12px] italic text-zinc-400">
              {t("noCoachingPoints")}
            </li>
          ) : (
            activeTags.map((t, i) => (
              <li
                key={`${t}-${i}`}
                className="flex items-start gap-2 rounded-md border border-zinc-100 bg-white px-3 py-1.5 text-[13px] text-zinc-800 shadow-sm"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                {t}
              </li>
            ))
          )}
        </ul>
      </Section>

      {/* Variations */}
      {(ex.variation_less_text || ex.variation_more_text) && (
        <Section title={t("variations")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <VariationCard
              kind="less"
              label={t("variationLess")}
              text={ex.variation_less_text}
            />
            <VariationCard
              kind="more"
              label={t("variationMore")}
              text={ex.variation_more_text}
            />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function VariationCard({
  kind,
  label,
  text,
}: {
  kind: "less" | "more";
  label: string;
  text: string | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold ${
            kind === "less" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {kind === "less" ? "−" : "+"}
        </span>
        {label}
      </div>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">
        {text || <span className="italic text-zinc-400">—</span>}
      </p>
    </div>
  );
}
