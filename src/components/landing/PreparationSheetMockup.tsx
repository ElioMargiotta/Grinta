export function PreparationSheetMockup() {
  const blocks = [
    {
      time: "00:00",
      dur: 15,
      name: "Activation neuromusculaire",
      family: "PE",
      desc: "Skipping, talons-fesses, pas chassés. 2×30s par appui.",
    },
    {
      time: "00:15",
      dur: 18,
      name: "Conservation 4v2 + appui",
      family: "TE",
      desc: "Carré 20×20m. 3 séries × 4'. 90s de récup.",
    },
    {
      time: "00:33",
      dur: 22,
      name: "Bloc médian — sortie axe",
      family: "TA",
      desc: "10v8 sur demi-terrain. Déclencheurs de pressing à mi-terrain.",
    },
    {
      time: "00:55",
      dur: 15,
      name: "Jeu réduit 4v4 + 2 jokers",
      family: "TA",
      desc: "Terrain 30×40m. 4 séries × 3'. 1' récup.",
    },
    {
      time: "01:10",
      dur: 10,
      name: "Décrassage + retour au calme",
      family: "PE",
      desc: "Footing souple 5', mobilité hanches & ischios 5'.",
    },
  ];
  const fam: Record<string, string> = {
    PE: "#c94a4a",
    TE: "#2d8f5f",
    TA: "#2f5fba",
    AT: "#7a5bb8",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden text-zinc-900">
      <div className="grid grid-cols-[1fr_auto] border-b border-zinc-200">
        <div className="px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Préparation de séance
          </div>
          <h3 className="mt-1 text-[18px] font-semibold tracking-tight">
            Conservation + sortie de balle
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 font-mono">
            <span>jeu. 14 nov.</span>
            <span>U17 · M. Margiotta</span>
            <span>80 min</span>
            <span>5 blocs</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5">
          <span className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hidden sm:inline">
            Imprimer
          </span>
          <span className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-zinc-900 text-white">
            Exporter PDF
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-200 text-[11px]">
        {[
          ["Thème", "Mon équipe possède le ballon"],
          ["Format", "3:3 au 5:5"],
          ["Microcycle", "S+2 / Compétition"],
          ["Charge", "Modérée"],
        ].map(([k, v], i) => (
          <div
            key={k}
            className={"px-4 py-2.5 " + (i < 3 ? "border-r border-zinc-200" : "")}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              {k}
            </div>
            <div className="mt-0.5 font-medium text-zinc-800">{v}</div>
          </div>
        ))}
      </div>

      <ol>
        {blocks.map((b, i) => (
          <li
            key={i}
            className="grid grid-cols-[60px_72px_1fr_auto] gap-4 px-5 py-3 border-b border-zinc-200 last:border-b-0"
          >
            <div className="text-[11px] font-mono text-zinc-500 pt-0.5">
              {b.time}
              <br />
              <span className="text-zinc-400">+{b.dur}&apos;</span>
            </div>
            <div className="relative h-12 w-16 rounded border border-zinc-200 bg-emerald-700 overflow-hidden">
              <div className="absolute inset-0 pitch-stripes opacity-90" />
              <svg viewBox="0 0 64 48" className="absolute inset-0 w-full h-full">
                <rect
                  x={2}
                  y={2}
                  width={60}
                  height={44}
                  fill="none"
                  stroke="rgba(255,255,255,.6)"
                  strokeWidth={0.4}
                />
                <line
                  x1={32}
                  y1={2}
                  x2={32}
                  y2={46}
                  stroke="rgba(255,255,255,.5)"
                  strokeWidth={0.4}
                />
                <circle
                  cx={32}
                  cy={24}
                  r={6}
                  fill="none"
                  stroke="rgba(255,255,255,.5)"
                  strokeWidth={0.4}
                />
                {[
                  [14, 16],
                  [24, 30],
                  [42, 18],
                  [50, 32],
                ].map(([x, y], k) => (
                  <circle
                    key={k}
                    cx={x}
                    cy={y}
                    r={1.6}
                    fill="#2f5fba"
                    stroke="#fff"
                    strokeWidth={0.3}
                  />
                ))}
                {[
                  [28, 22],
                  [40, 28],
                ].map(([x, y], k) => (
                  <circle
                    key={"r" + k}
                    cx={x}
                    cy={y}
                    r={1.6}
                    fill="#c94a4a"
                    stroke="#fff"
                    strokeWidth={0.3}
                  />
                ))}
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                  {b.family}
                </span>
                <span className="text-[13px] font-semibold leading-tight">
                  {b.name}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">
                {b.desc}
              </p>
            </div>
            <span
              className="self-start mt-0.5 inline-block w-1 h-12 rounded-sm"
              style={{ background: fam[b.family] }}
            />
          </li>
        ))}
      </ol>

      <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Page 1 / 1</span>
        <span className="font-mono">grinta.app · sheet 24·11·14</span>
      </div>
    </div>
  );
}
