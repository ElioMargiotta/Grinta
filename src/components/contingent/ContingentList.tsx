"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import {
  bulkAssignPlayersToTeamAction,
  bulkDeletePlayersAction,
} from "@/app/[locale]/(app)/contingent/actions";
import type { ClubTeamOption } from "@/lib/contingent/teams";
import { KindBadge } from "@/components/contingent/AvailabilitySection";
import type { UnavailabilityKind } from "@/lib/availability/unavailability";

export type ContingentAssignment = {
  team_id: string;
  team_name: string | null;
  age_group: string | null;
};

export type ContingentPlayer = {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  jersey_number: number | null;
  birth_date: string | null;
  /** True iff `players.dual_licence_club IS NOT NULL` — drives the "DL" badge (EPIC #34). */
  has_dual_licence: boolean;
  assignments: ContingentAssignment[];
  /** Indisponibilité active aujourd'hui (médical/discipline), sinon null. */
  unavailabilityKind: UnavailabilityKind | null;
  /** Taux de présence saison (0–1), null si aucune séance. */
  presenceRate: number | null;
};

type SortKey = "name" | "position" | "presence" | "availability";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

export function ContingentList({
  players,
  teams,
  initialTeamFilter,
}: {
  players: ContingentPlayer[];
  /** Équipes actives du club — alimente le filtre et le picker de l'action en bloc (#39). */
  teams: ClubTeamOption[];
  /** Filtre équipe initial (typiquement venant de /teams/{id} via ?team=). */
  initialTeamFilter?: string;
}) {
  const t = useTranslations("contingent");
  const tBulk = useTranslations("contingent.bulk");
  const tDual = useTranslations("contingent.dualLicence");
  const locale = useLocale();
  const router = useRouter();
  const tMed = useTranslations("availability");
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState(initialTeamFilter ?? ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTeamId, setBulkTeamId] = useState<string>("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const categoryOptions = useMemo(() => {
    const fromAssignments = new Set<string>();
    for (const p of players) {
      for (const a of p.assignments) {
        if (a.age_group) fromAssignments.add(a.age_group);
      }
    }
    for (const team of teams) {
      if (team.age_group) fromAssignments.add(team.age_group);
    }
    return [...fromAssignments].sort((a, b) => a.localeCompare(b));
  }, [players, teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (q) {
        const hay = `${p.first_name} ${p.last_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        teamFilter !== ALL &&
        teamFilter !== UNASSIGNED &&
        !p.assignments.some((a) => a.team_id === teamFilter)
      ) {
        return false;
      }
      if (teamFilter === UNASSIGNED && p.assignments.length > 0) return false;
      if (
        category !== ALL &&
        !p.assignments.some((a) => a.age_group === category)
      ) {
        return false;
      }
      if (status === UNASSIGNED && p.assignments.length > 0) return false;
      if (status === "assigned" && p.assignments.length === 0) return false;
      return true;
    });
  }, [players, query, teamFilter, category, status]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`,
          );
          break;
        case "position":
          cmp = (a.position ?? "").localeCompare(b.position ?? "");
          break;
        case "presence":
          cmp = (a.presenceRate ?? -1) - (b.presenceRate ?? -1);
          break;
        case "availability":
          cmp =
            Number(Boolean(a.unavailabilityKind)) -
            Number(Boolean(b.unavailabilityKind));
          break;
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filteredIds = useMemo(() => filtered.map((p) => p.id), [filtered]);
  const allSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkMessage(null);
    setBulkError(null);
    setConfirmingDelete(false);
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
    setBulkMessage(null);
    setBulkError(null);
    setConfirmingDelete(false);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setBulkMessage(null);
    setBulkError(null);
    setConfirmingDelete(false);
  };

  const runBulkDelete = () => {
    setBulkError(null);
    setBulkMessage(null);
    const ids = [...selected];
    if (ids.length === 0) return;
    const fd = new FormData();
    fd.set("locale", locale);
    for (const id of ids) fd.append("playerIds", id);
    startDeleteTransition(async () => {
      const result = await bulkDeletePlayersAction(fd);
      if (result?.error) {
        setBulkError(result.error);
        return;
      }
      setBulkMessage(tBulk("deleted", { deleted: result?.deleted ?? 0 }));
      setSelected(new Set());
      setConfirmingDelete(false);
      router.refresh();
    });
  };

  const runBulkAssign = () => {
    setBulkError(null);
    setBulkMessage(null);
    if (!bulkTeamId) {
      setBulkError(tBulk("pickTeam"));
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) return;
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("teamId", bulkTeamId);
    for (const id of ids) fd.append("playerIds", id);
    startTransition(async () => {
      const result = await bulkAssignPlayersToTeamAction(fd);
      if (result?.error) {
        setBulkError(result.error);
        return;
      }
      setBulkMessage(
        tBulk("done", {
          assigned: result?.assigned ?? 0,
          skipped: result?.skipped ?? 0,
        }),
      );
      setSelected(new Set());
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("search")}
        />
        <Select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          aria-label={t("filterTeam")}
        >
          <option value={ALL}>{t("allTeams")}</option>
          <option value={UNASSIGNED}>{t("statusUnassigned")}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
              {tm.age_group ? ` · ${tm.age_group}` : ""}
            </option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={t("filterCategory")}
        >
          <option value={ALL}>{t("allCategories")}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t("filterStatus")}
        >
          <option value={ALL}>{t("allStatuses")}</option>
          <option value="assigned">{t("statusAssigned")}</option>
          <option value={UNASSIGNED}>{t("statusUnassigned")}</option>
        </Select>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("count", { n: filtered.length, total: players.length })}
      </p>

      {selected.size > 0 && (
        <Card className="border-[var(--club-primary)] bg-[var(--club-primary-soft)]/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {tBulk("selected", { n: selected.size })}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {tBulk("hint")}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={bulkTeamId}
                onChange={(e) => setBulkTeamId(e.target.value)}
                aria-label={tBulk("pickTeam")}
                className="min-w-[180px]"
              >
                <option value="">{tBulk("pickTeam")}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                    {tm.age_group ? ` · ${tm.age_group}` : ""}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                onClick={runBulkAssign}
                loading={isPending}
                loadingLabel={tBulk("assigning")}
                disabled={!bulkTeamId || selected.size === 0}
              >
                {tBulk("assign")}
              </Button>
              {!confirmingDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(true);
                    setBulkError(null);
                    setBulkMessage(null);
                  }}
                  disabled={selected.size === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  {tBulk("delete")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={runBulkDelete}
                    loading={isDeleting}
                    loadingLabel={tBulk("deleting")}
                  >
                    {tBulk("confirmDelete", { n: selected.size })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isDeleting}
                  >
                    {tBulk("cancel")}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {tBulk("clear")}
              </Button>
            </div>
          </div>
          {confirmingDelete && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {tBulk("confirmHint", { n: selected.size })}
            </p>
          )}
          {bulkError && (
            <p className="mt-2 text-sm text-red-600">{bulkError}</p>
          )}
          {bulkMessage && !bulkError && (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {bulkMessage}
            </p>
          )}
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("empty")}
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label={tBulk("selectAll")}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-2">#</th>
                <SortHeader label={t("name")} active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <SortHeader label={t("position")} active={sortKey === "position"} dir={sortDir} onClick={() => toggleSort("position")} />
                <SortHeader label={tMed("tab")} active={sortKey === "availability"} dir={sortDir} onClick={() => toggleSort("availability")} />
                <SortHeader label={t("presence")} active={sortKey === "presence"} dir={sortDir} onClick={() => toggleSort("presence")} />
                <th className="px-4 py-2">{t("teams")}</th>
                <th className="px-4 py-2">{t("birthDate")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const isOn = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${
                      isOn ? "bg-[var(--club-primary-soft)]/40" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={tBulk("selectOne", {
                          name: `${p.first_name} ${p.last_name}`,
                        })}
                        checked={isOn}
                        onChange={() => toggleOne(p.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.jersey_number ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/contingent/${p.id}`}
                          className="font-medium text-[var(--club-primary)] hover:underline"
                        >
                          {p.first_name} {p.last_name}
                        </Link>
                        {p.has_dual_licence && (
                          <span
                            title={tDual("badgeTitle")}
                            className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-200"
                          >
                            {tDual("badge")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.position ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.unavailabilityKind ? (
                        <KindBadge
                          kind={p.unavailabilityKind}
                          label={tMed(`kind.${p.unavailabilityKind}`)}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          {t("available")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.presenceRate === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <span className="font-mono tabular-nums">
                          {Math.round(p.presenceRate * 100)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.assignments.length === 0 ? (
                        <span className="text-zinc-400 italic">
                          {t("statusUnassigned")}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.assignments.map((a) => (
                            <Link
                              key={a.team_id}
                              href={`/teams/${a.team_id}`}
                              className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:border-[var(--club-primary)] hover:text-[var(--club-primary)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                            >
                              {a.team_name ?? a.team_id.slice(0, 6)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.birth_date ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${
          active ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </button>
    </th>
  );
}
