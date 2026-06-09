"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  KeyRound,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { ClubPlayerForm, type EditablePlayer } from "./ClubPlayerForm";
import { DeletePlayerSection } from "./DeletePlayerSection";
import { DualLicenceBlock } from "./DualLicenceBlock";
import { InvitePlayerSection, type PlayerInvitation } from "./InvitePlayerSection";
import { TeamAssignmentsBlock } from "./TeamAssignmentsBlock";
import {
  EvaluationsSection,
  type EvaluationRow,
} from "@/components/evaluation/EvaluationsSection";
import { Section, SectionHeader } from "@/components/ui/Section";
import type { ClubTeamOption } from "@/lib/contingent/teams";

type Tab = "profile" | "assignment" | "stats" | "followup" | "admin";

type PlayerWithUser = EditablePlayer & { user_id: string | null };

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value === null || value === "" ? "-" : value}
      </div>
    </div>
  );
}

export function ContingentPlayerProfile({
  player,
  fullName,
  teams,
  currentTeamIds,
  pendingInvitations,
  evaluations,
  evaluationsShareAvailable,
  locale,
}: {
  player: PlayerWithUser;
  fullName: string;
  teams: ClubTeamOption[];
  currentTeamIds: string[];
  pendingInvitations: PlayerInvitation[];
  evaluations: EvaluationRow[];
  evaluationsShareAvailable: boolean;
  locale: string;
}) {
  const t = useTranslations("contingent.playerProfile");
  const tc = useTranslations("contingent.form");
  const [tab, setTab] = useState<Tab>("profile");

  const assignedTeams = useMemo(
    () =>
      currentTeamIds
        .map((id) => teams.find((team) => team.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [currentTeamIds, teams],
  );

  const tabs: { key: Tab; label: string; icon: typeof UserRound; count?: number }[] = [
    { key: "profile", label: t("tabs.profile"), icon: UserRound },
    {
      key: "assignment",
      label: t("tabs.assignment"),
      icon: BadgeCheck,
      count: assignedTeams.length,
    },
    { key: "stats", label: t("tabs.stats"), icon: BarChart3 },
    { key: "followup", label: t("tabs.followup"), icon: ClipboardList, count: evaluations.length },
    { key: "admin", label: t("tabs.admin"), icon: ShieldAlert, count: pendingInvitations.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-[var(--club-line)] bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--club-primary)] text-lg font-semibold text-[var(--club-primary-foreground)]">
              {initials(player.first_name, player.last_name)}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                {t("eyebrow")}
              </div>
              <h1 className="mt-1 truncate text-2xl font-semibold text-zinc-950 dark:text-zinc-100">
                {fullName}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {player.position ? <span>{player.position}</span> : null}
                {player.jersey_number ? <span>#{player.jersey_number}</span> : null}
                {assignedTeams.length > 0 ? <span>{assignedTeams.join(", ")}</span> : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
            <div className="rounded-md border border-[var(--club-line)] px-3 py-2">
              <div className="font-mono text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                {assignedTeams.length}
              </div>
              <div className="text-[11px] text-zinc-500">{t("stats.teams")}</div>
            </div>
            <div className="rounded-md border border-[var(--club-line)] px-3 py-2">
              <div className="font-mono text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                {evaluations.length}
              </div>
              <div className="text-[11px] text-zinc-500">{t("stats.reports")}</div>
            </div>
            <div className="rounded-md border border-[var(--club-line)] px-3 py-2">
              <div className="font-mono text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                {pendingInvitations.length}
              </div>
              <div className="text-[11px] text-zinc-500">{t("stats.invites")}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-[var(--club-line)] pt-4 sm:grid-cols-4">
          <Detail label={tc("birthDate")} value={player.birth_date} />
          <Detail label={tc("email")} value={player.email} />
          <Detail label={tc("phone")} value={player.phone} />
          <Detail label={tc("licenseNumber")} value={player.license_number} />
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map(({ key, label, icon: Icon, count }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 text-[13px] font-semibold transition ${
                active
                  ? "border-[var(--club-primary)] text-zinc-950 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {typeof count === "number" ? (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "profile" ? (
        <Section>
          <SectionHeader icon={UserRound} title={t("profileTitle")} className="mb-4" />
          <ClubPlayerForm player={player} />
        </Section>
      ) : null}

      {tab === "assignment" ? (
        <div className="flex flex-col gap-6">
          <TeamAssignmentsBlock
            playerId={player.id}
            teams={teams}
            currentTeamIds={currentTeamIds}
          />
          <DualLicenceBlock
            playerId={player.id}
            licence={{
              club: player.dual_licence_club,
              level: player.dual_licence_level,
              team: player.dual_licence_team,
            }}
          />
        </div>
      ) : null}

      {tab === "stats" ? (
        <Section>
          <SectionHeader icon={BarChart3} title={t("statsTitle")} className="mb-4" />
          <div className="grid gap-3 sm:grid-cols-3">
            {(["presence", "sessions", "availability"] as const).map((metric) => (
              <div
                key={metric}
                className="rounded-md border border-[var(--club-line)] bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                  {t(`metrics.${metric}.label`)}
                </div>
                <div className="mt-3 font-mono text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                  -
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t(`metrics.${metric}.hint`)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {tab === "followup" ? (
        <EvaluationsSection
          playerId={player.id}
          locale={locale}
          evaluations={evaluations}
          sharingAvailable={evaluationsShareAvailable}
        />
      ) : null}

      {tab === "admin" ? (
        <div className="flex flex-col gap-6">
          <InvitePlayerSection
            locale={locale}
            playerId={player.id}
            defaultEmail={player.email ?? ""}
            teams={teams.map((team) => ({ id: team.id, name: team.name }))}
            pendingInvitations={pendingInvitations}
            isLinkedToUser={Boolean(player.user_id)}
          />
          <DeletePlayerSection playerId={player.id} playerName={fullName} />
        </div>
      ) : null}
    </div>
  );
}
