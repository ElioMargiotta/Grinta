// High-fidelity recreation of PlannerWeeksGrid for the marketing landing.
// Static mock — purely presentational.

const TYPE_COLOR: Record<string, string> = {
  tactical: "#2f5fba",
  physical: "#c94a4a",
  technical: "#2d8f5f",
  mental: "#7a5bb8",
  recovery: "#64748b",
  setpiece: "#7a5bb8",
  match: "#c47a24",
};

const THEME: Record<
  string,
  { dot: string; bg: string; label: string }
> = {
  possede: {
    dot: "#16a34a",
    bg: "bg-emerald-50/70",
    label: "Mon équipe possède le ballon",
  },
  ne_possede_pas: {
    dot: "#dc2626",
    bg: "bg-rose-50/70",
    label: "Mon équipe ne possède pas le ballon",
  },
  recupere: {
    dot: "#2563eb",
    bg: "bg-sky-50/70",
    label: "Mon équipe récupère le ballon",
  },
  perd: {
    dot: "#d97706",
    bg: "bg-amber-50/70",
    label: "Mon équipe perd le ballon",
  },
  decharge: {
    dot: "#94a3b8",
    bg: "bg-zinc-50/70",
    label: "Décharge",
  },
};

type SessionT = {
  time: string;
  duration: number;
  title: string;
  types: string[];
  isMatch?: boolean;
};

function SessionCard({ time, duration, title, types, isMatch }: SessionT) {
  const bar =
    types.length === 1
      ? TYPE_COLOR[types[0]]
      : `linear-gradient(180deg, ${types
          .map(
            (t, i) =>
              `${TYPE_COLOR[t]} ${Math.round((i * 100) / types.length)}% ${Math.round(
                ((i + 1) * 100) / types.length,
              )}%`,
          )
          .join(", ")})`;
  return (
    <div className="relative flex w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-[3px]"
        style={{ background: bar }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pl-3 pr-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold tabular-nums text-zinc-500">
            {time}
          </span>
          <span className="text-[10px] font-medium tabular-nums text-zinc-400">
            {duration}&apos;
          </span>
        </div>
        <span className="truncate text-[11px] font-semibold leading-tight text-zinc-900">
          {isMatch ? "⚽ " : ""}
          {title}
        </span>
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-1 rounded border border-dashed border-zinc-200 px-1.5 py-1 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <span>+</span>
    </div>
  );
}

function WeekSummary({
  sessions,
  h,
  m,
  distribution,
}: {
  sessions: number;
  h: number;
  m: number;
  distribution: Array<[string, number]>;
}) {
  const total = distribution.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="flex flex-col gap-2 border-b border-l border-zinc-200 bg-zinc-50/60 px-3 py-3 text-[11px]">
      <div className="flex items-center justify-between text-zinc-500">
        <span>Séances</span>
        <strong className="font-semibold tabular-nums text-zinc-900">{sessions}</strong>
      </div>
      <div className="flex items-center justify-between text-zinc-500">
        <span>Durée totale</span>
        <strong className="font-semibold tabular-nums text-zinc-900">
          {h}h {m}m
        </strong>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200">
        {distribution.map(([t, v]) => (
          <span
            key={t}
            className="block h-full"
            style={{ width: `${(v / total) * 100}%`, background: TYPE_COLOR[t] }}
          />
        ))}
      </div>
    </div>
  );
}

function WeekLabel({
  weekN,
  dateRange,
  theme,
  format,
  current,
}: {
  weekN: string;
  dateRange: string;
  theme: keyof typeof THEME;
  format?: string;
  current?: boolean;
}) {
  const th = THEME[theme];
  return (
    <div
      className={
        "flex flex-col justify-between gap-2 border-b border-r border-l-[5px] border-zinc-200 px-3.5 py-3 " +
        (th?.bg ?? "bg-zinc-50/70")
      }
      style={{ borderLeftColor: th?.dot ?? "#cbd5e1" }}
    >
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold tracking-tight text-zinc-900">
            Semaine {weekN}
          </span>
          {current && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              en cours
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500">{dateRange}</div>
        <div className="mt-2 flex w-full items-start gap-2 rounded-md border border-zinc-200/80 bg-white/80 px-2 py-1.5 text-left">
          <span
            className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: th?.dot ?? "#cbd5e1" }}
          />
          <span className="flex-1 text-[11px] font-semibold leading-tight text-zinc-800">
            {th ? <span className="line-clamp-2">{th.label}</span> : null}
          </span>
        </div>
        {format && <div className="mt-1 text-[10px] text-zinc-400">{format}</div>}
      </div>
    </div>
  );
}

function DayCell({
  date,
  isToday,
  isWeekend,
  morning,
  past,
}: {
  date: string;
  isToday?: boolean;
  isWeekend?: boolean;
  morning?: SessionT;
  past?: boolean;
}) {
  const baseBg = isToday ? "bg-amber-50/60" : isWeekend ? "bg-zinc-50/70" : "bg-white";
  return (
    <div
      className={
        "group relative flex min-h-[110px] flex-col gap-1 border-b border-r border-zinc-200 p-1.5 " +
        baseBg +
        (past ? " opacity-60 saturate-[0.65]" : "")
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            "text-[10px] tabular-nums " +
            (isToday
              ? "rounded bg-zinc-900 px-1 py-px font-semibold text-white"
              : "text-zinc-400")
          }
        >
          {date}
        </span>
      </div>
      {morning ? <SessionCard {...morning} /> : <EmptySlot label="Matin" />}
      <EmptySlot label="Après-midi" />
    </div>
  );
}

function MesoRibbon({
  name,
  kind,
  weeks,
  range,
  color,
}: {
  name: string;
  kind: string;
  weeks: string;
  range: string;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr_200px] border-b border-zinc-900 bg-zinc-900 text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
      <div className="flex items-center gap-2 px-3.5 py-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{name}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 normal-case tracking-normal text-emerald-300">
        <span className="opacity-70">{kind}</span>
        <span className="opacity-40">·</span>
        <span>{range}</span>
      </div>
      <div className="px-3 py-1.5 text-right normal-case tracking-normal text-zinc-400">
        {weeks} semaines
      </div>
    </div>
  );
}

const headerCell =
  "border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500";

export function PlannerMockup() {
  const types: Array<[string, string]> = [
    ["tactical", "Tactique"],
    ["physical", "Physique"],
    ["technical", "Technique"],
    ["mental", "Mentalité"],
    ["recovery", "Récup."],
    ["setpiece", "Coups arrêtés"],
    ["match", "Match"],
  ];

  return (
    <div className="flex flex-col gap-3 text-zinc-900">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5">
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
            ‹
          </span>
          <span className="min-w-[140px] text-center text-sm font-semibold tracking-tight text-zinc-900">
            novembre 2025
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
            ›
          </span>
          <span className="ml-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700">
            Aujourd&apos;hui
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {types.map(([k, label]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-sm"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: TYPE_COLOR[k] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm no-scrollbar">
        <div className="grid min-w-[1080px] grid-cols-[200px_repeat(7,minmax(0,1fr))_200px]">
          <div className={headerCell}>Semaine</div>
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className={headerCell}>
              {d}
            </div>
          ))}
          <div className={headerCell.replace("border-r", "")}>Récap</div>

          <div className="col-span-full">
            <MesoRibbon
              name="Compétition"
              kind="Compétition"
              weeks="8"
              range="Semaine +1 – Semaine +8"
              color="#86efac"
            />
          </div>

          <WeekLabel
            weekN="+1"
            dateRange="3 nov. – 9 nov."
            theme="possede"
            format="3:3 au 5:5"
          />
          <DayCell date="3" past />
          <DayCell
            date="4"
            past
            morning={{
              time: "18:30",
              duration: 75,
              title: "Conservation 4v2 + appui",
              types: ["technical"],
            }}
          />
          <DayCell date="5" past />
          <DayCell
            date="6"
            past
            morning={{
              time: "18:30",
              duration: 80,
              title: "Bloc médian — sortie axe",
              types: ["tactical"],
            }}
          />
          <DayCell
            date="7"
            past
            morning={{
              time: "18:00",
              duration: 45,
              title: "Activation + décrassage",
              types: ["physical"],
            }}
          />
          <DayCell
            date="8"
            past
            isWeekend
            morning={{
              time: "15:00",
              duration: 90,
              title: "Vs FC Volcan · domicile",
              types: ["match"],
              isMatch: true,
            }}
          />
          <DayCell date="9" past isWeekend />
          <WeekSummary
            sessions={4}
            h={4}
            m={50}
            distribution={[
              ["technical", 75],
              ["tactical", 80],
              ["physical", 45],
              ["match", 90],
            ]}
          />

          <WeekLabel
            weekN="+2"
            dateRange="10 nov. – 16 nov."
            theme="possede"
            format="3:3 au 5:5"
            current
          />
          <DayCell date="10" />
          <DayCell
            date="11"
            morning={{
              time: "18:30",
              duration: 75,
              title: "Rondo 5v2 + appui",
              types: ["technical"],
            }}
          />
          <DayCell date="12" />
          <DayCell
            date="13"
            isToday
            morning={{
              time: "18:30",
              duration: 80,
              title: "Conservation + sortie",
              types: ["tactical", "technical"],
            }}
          />
          <DayCell
            date="14"
            morning={{
              time: "18:00",
              duration: 50,
              title: "Course intermittente 30/30",
              types: ["physical"],
            }}
          />
          <DayCell
            date="15"
            isWeekend
            morning={{
              time: "15:00",
              duration: 90,
              title: "Vs AS Cèdre · ext.",
              types: ["match"],
              isMatch: true,
            }}
          />
          <DayCell date="16" isWeekend />
          <WeekSummary
            sessions={4}
            h={4}
            m={55}
            distribution={[
              ["technical", 75],
              ["tactical", 80],
              ["physical", 50],
              ["match", 90],
            ]}
          />

          <WeekLabel
            weekN="+3"
            dateRange="17 nov. – 23 nov."
            theme="ne_possede_pas"
            format="3:3 au 5:5"
          />
          <DayCell date="17" />
          <DayCell
            date="18"
            morning={{
              time: "18:30",
              duration: 75,
              title: "Bloc bas → contre",
              types: ["tactical"],
            }}
          />
          <DayCell date="19" />
          <DayCell
            date="20"
            morning={{
              time: "18:30",
              duration: 80,
              title: "Pressing déclencheurs",
              types: ["tactical", "mental"],
            }}
          />
          <DayCell
            date="21"
            morning={{
              time: "18:00",
              duration: 45,
              title: "Mobilité + activation",
              types: ["recovery"],
            }}
          />
          <DayCell
            date="22"
            isWeekend
            morning={{
              time: "15:00",
              duration: 90,
              title: "Vs Olympic Lyon · dom.",
              types: ["match"],
              isMatch: true,
            }}
          />
          <DayCell date="23" isWeekend />
          <WeekSummary
            sessions={4}
            h={4}
            m={50}
            distribution={[
              ["tactical", 115],
              ["mental", 30],
              ["recovery", 45],
              ["match", 90],
            ]}
          />

          <WeekLabel
            weekN="+4"
            dateRange="24 nov. – 30 nov."
            theme="perd"
            format="3:3 au 5:5"
          />
          <DayCell date="24" />
          <DayCell
            date="25"
            morning={{
              time: "18:30",
              duration: 75,
              title: "Réaction perte — 5s",
              types: ["tactical", "mental"],
            }}
          />
          <DayCell date="26" />
          <DayCell
            date="27"
            morning={{
              time: "18:30",
              duration: 80,
              title: "Replacement + duels",
              types: ["tactical"],
            }}
          />
          <DayCell
            date="28"
            morning={{
              time: "18:00",
              duration: 50,
              title: "Plyo + sprints",
              types: ["physical"],
            }}
          />
          <DayCell
            date="29"
            isWeekend
            morning={{
              time: "15:00",
              duration: 90,
              title: "Vs FC Eclair · ext.",
              types: ["match"],
              isMatch: true,
            }}
          />
          <DayCell date="30" isWeekend />
          <WeekSummary
            sessions={4}
            h={4}
            m={55}
            distribution={[
              ["tactical", 115],
              ["mental", 30],
              ["physical", 50],
              ["match", 90],
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-zinc-200 bg-zinc-50/70 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Séances
          </span>
          <span className="text-lg font-bold tabular-nums text-zinc-900">16</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Durée totale
          </span>
          <span className="text-lg font-bold tabular-nums text-zinc-900">
            19<span className="ml-0.5 text-xs font-medium text-zinc-500">h 30m</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Moy. / sem.
          </span>
          <span className="text-lg font-bold tabular-nums text-zinc-900">
            4.9<span className="ml-0.5 text-xs font-medium text-zinc-500">h</span>
          </span>
        </div>
        <div className="flex max-w-[420px] flex-1 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Répartition par type
          </span>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200">
            {[
              ["tactical", 0.42],
              ["match", 0.22],
              ["technical", 0.14],
              ["physical", 0.12],
              ["mental", 0.06],
              ["recovery", 0.04],
            ].map(([t, p]) => (
              <span
                key={t as string}
                className="block h-full"
                style={{
                  width: `${(p as number) * 100}%`,
                  background: TYPE_COLOR[t as string],
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 text-[10px] text-zinc-500">
            {[
              ["tactical", "Tactique", 42],
              ["match", "Match", 22],
              ["technical", "Technique", 14],
              ["physical", "Physique", 12],
            ].map(([t, l, p]) => (
              <span key={t as string} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: TYPE_COLOR[t as string] }}
                />
                {l} {p}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
