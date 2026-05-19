"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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
  assignments: ContingentAssignment[];
};

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

export function ContingentList({ players }: { players: ContingentPlayer[] }) {
  const t = useTranslations("contingent");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of players) {
      for (const a of p.assignments) {
        if (a.team_id && !map.has(a.team_id)) {
          map.set(a.team_id, a.team_name ?? a.team_id);
        }
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      for (const a of p.assignments) {
        if (a.age_group) set.add(a.age_group);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (q) {
        const hay = `${p.first_name} ${p.last_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (team !== ALL && !p.assignments.some((a) => a.team_id === team)) {
        return false;
      }
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
  }, [players, query, team, category, status]);

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
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          aria-label={t("filterTeam")}
        >
          <option value={ALL}>{t("allTeams")}</option>
          {teamOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
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
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">{t("name")}</th>
                <th className="px-4 py-2">{t("position")}</th>
                <th className="px-4 py-2">{t("teams")}</th>
                <th className="px-4 py-2">{t("birthDate")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 text-zinc-500">
                    {p.jersey_number ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/contingent/${p.id}`}
                      className="font-medium text-[var(--club-primary)] hover:underline"
                    >
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.position ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.assignments.length === 0
                      ? t("statusUnassigned")
                      : p.assignments
                          .map((a) => a.team_name)
                          .filter(Boolean)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.birth_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
