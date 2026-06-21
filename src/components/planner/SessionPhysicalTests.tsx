"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Activity, Info, X } from "lucide-react";
import {
  attachTestToSessionAction,
  detachTestFromSessionAction,
  recordSessionMeasurementAction,
} from "@/app/[locale]/(app)/contingent/[playerId]/physical/actions";
import { declareUnavailabilityFromSessionAction } from "@/app/[locale]/(app)/contingent/[playerId]/medical/actions";
import { KindBadge } from "@/components/contingent/MedicalSection";
import {
  UNAVAILABILITY_KINDS,
  type PlayerAvailability,
} from "@/lib/medical/unavailability";

export type SessionTestMetric = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  description: string | null;
  protocol: string | null;
};

export type SessionTestPlayer = {
  playerId: string;
  fullName: string;
  jerseyNumber: number | null;
};

export type SessionTestResult = {
  player_id: string;
  metric_id: string;
  value: number | null;
};

function parseValue(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmt(value: number | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function SessionPhysicalTests({
  locale,
  teamId,
  sessionId,
  players,
  metrics,
  attachedIds,
  results,
  availability = {},
  evalDate,
  canRecord,
}: {
  locale: string;
  teamId: string;
  sessionId: string;
  players: SessionTestPlayer[];
  metrics: SessionTestMetric[];
  attachedIds: string[];
  results: SessionTestResult[];
  availability?: Record<string, PlayerAvailability>;
  evalDate: string;
  canRecord: boolean;
}) {
  const t = useTranslations("attendance.physicalTests");
  const tMed = useTranslations("medical");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState("");
  const [openProtocol, setOpenProtocol] = useState<string | null>(null);

  const attachedSet = useMemo(() => new Set(attachedIds), [attachedIds]);
  const attached = useMemo(
    () => metrics.filter((m) => attachedSet.has(m.id)),
    [metrics, attachedSet],
  );
  const available = useMemo(
    () => metrics.filter((m) => !attachedSet.has(m.id)),
    [metrics, attachedSet],
  );

  const byKey = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const r of results) map.set(`${r.player_id}|${r.metric_id}`, r.value);
    return map;
  }, [results]);

  function attach(metricId: string) {
    if (!metricId) return;
    setError(null);
    setPicker("");
    startTransition(async () => {
      const res = await attachTestToSessionAction({ locale, teamId, sessionId, metricId });
      if (res?.error) setError(res.error);
    });
  }

  function detach(metricId: string) {
    setError(null);
    startTransition(async () => {
      const res = await detachTestFromSessionAction({ locale, teamId, sessionId, metricId });
      if (res?.error) setError(res.error);
    });
  }

  function commit(playerId: string, metricId: string, raw: string) {
    const value = parseValue(raw);
    const prev = byKey.get(`${playerId}|${metricId}`) ?? null;
    if (value === prev) return;
    setError(null);
    startTransition(async () => {
      const res = await recordSessionMeasurementAction({
        locale,
        teamId,
        sessionId,
        playerId,
        metricId,
        value,
      });
      if (res?.error) setError(res.error);
    });
  }

  function declare(playerId: string, kind: string) {
    if (!kind) return;
    setError(null);
    startTransition(async () => {
      const res = await declareUnavailabilityFromSessionAction({
        locale,
        teamId,
        sessionId,
        playerId,
        kind,
        startDate: evalDate,
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            <Activity className="h-4 w-4 text-[var(--club-primary)]" />
            {t("title")}
          </h2>
          <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">{t("intro")}</p>
        </div>
        {canRecord && available.length > 0 ? (
          <select
            value={picker}
            disabled={pending}
            onChange={(e) => attach(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[13px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">{t("addTest")}</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.unit ? ` (${m.unit})` : ""}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {attached.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {t("none")}
        </div>
      ) : (
        <>
          {/* Protocoles repliables */}
          <div className="flex flex-wrap gap-2">
            {attached.map((m) =>
              m.protocol || m.description ? (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOpenProtocol((id) => (id === m.id ? null : m.id))}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-[12px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Info className="h-3.5 w-3.5" />
                  {m.name}
                </button>
              ) : null,
            )}
          </div>
          {openProtocol ? (
            (() => {
              const m = attached.find((x) => x.id === openProtocol);
              if (!m) return null;
              return (
                <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <div className="mb-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {m.name}
                    {m.unit ? <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{m.unit}</span> : null}
                  </div>
                  {m.description ? (
                    <p className="text-[13px] text-zinc-600 dark:text-zinc-300">{m.description}</p>
                  ) : null}
                  {m.protocol ? (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-zinc-600 dark:text-zinc-300">
                      {m.protocol}
                    </p>
                  ) : null}
                </div>
              );
            })()
          ) : null}

          {/* Grille joueurs × tests */}
          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">{t("colPlayer")}</th>
                  {attached.map((m) => (
                    <th key={m.id} className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>
                          {m.name}
                          {m.unit ? <span className="ml-1 normal-case text-zinc-400">{m.unit}</span> : null}
                        </span>
                        {canRecord ? (
                          <button
                            type="button"
                            onClick={() => detach(m.id)}
                            disabled={pending}
                            title={t("detach")}
                            aria-label={t("detach")}
                            className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </th>
                  ))}
                  {canRecord ? <th className="px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {players.map((p) => {
                  const avail = availability[p.playerId] ?? { status: "available" };
                  const unavailable = avail.status !== "available";
                  return (
                    <tr key={p.playerId} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {p.jerseyNumber !== null && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--club-primary-soft)] text-[11px] font-semibold text-[var(--club-primary)]">
                              {p.jerseyNumber}
                            </span>
                          )}
                          <span
                            className={
                              unavailable
                                ? "font-medium text-zinc-400 line-through dark:text-zinc-500"
                                : "font-medium text-zinc-900 dark:text-zinc-100"
                            }
                          >
                            {p.fullName}
                          </span>
                        </div>
                      </td>
                      {unavailable ? (
                        <td
                          colSpan={attached.length}
                          className="px-3 py-2 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {avail.status === "unavailable" ? (
                              <KindBadge
                                kind={avail.kind}
                                label={tMed(`kind.${avail.kind}`)}
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {t("absent")}
                              </span>
                            )}
                            {avail.reason ? (
                              <span className="text-[12px] italic text-zinc-400">
                                {avail.reason}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      ) : (
                        attached.map((m) => {
                          const key = `${p.playerId}|${m.id}`;
                          const val = byKey.get(key) ?? null;
                          return (
                            <td key={m.id} className="px-2 py-1 text-center">
                              {canRecord ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  key={key}
                                  defaultValue={fmt(val)}
                                  disabled={pending}
                                  onBlur={(e) => commit(p.playerId, m.id, e.target.value)}
                                  placeholder="—"
                                  className="w-16 rounded-md border border-transparent bg-zinc-50 px-2 py-1 text-center font-mono tabular-nums text-zinc-900 hover:border-zinc-300 focus:border-[var(--club-primary)] focus:bg-white focus:outline-none dark:bg-zinc-800/50 dark:text-zinc-100 dark:focus:bg-zinc-800"
                                />
                              ) : (
                                <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                                  {fmt(val) || "—"}
                                </span>
                              )}
                            </td>
                          );
                        })
                      )}
                      {canRecord ? (
                        <td className="px-2 py-1 text-right">
                          {unavailable ? null : (
                            <select
                              value=""
                              disabled={pending}
                              onChange={(e) => declare(p.playerId, e.target.value)}
                              title={t("declareUnavailable")}
                              aria-label={t("declareUnavailable")}
                              className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                            >
                              <option value="">{t("declareUnavailable")}</option>
                              {UNAVAILABILITY_KINDS.map((k) => (
                                <option key={k} value={k}>
                                  {tMed(`kind.${k}`)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={attached.length + (canRecord ? 2 : 1)} className="px-3 py-6 text-center text-zinc-500">
                      {t("emptyRoster")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
