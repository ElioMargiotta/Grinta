import { HalfPitch } from "@/components/sheet/Pitch";

export function ExerciseDetailMockup() {
  const families = [
    { id: "PE", label: "Forme physique", count: 3 },
    { id: "TA", label: "Tactique", count: 5 },
    { id: "AT", label: "Mentalité", count: 2 },
    { id: "TE", label: "Technique", count: 4, active: true },
  ];
  const techniquePoints = [
    "Premier contact orienté vers l'avant",
    "Passe à ras de terre, pied de la jambe d'appel",
    "Corps profilé pour l'appui dos au but",
    "Course de soutien au porteur — angle 45°",
  ];
  return (
    <div className="flex flex-col gap-6 text-zinc-900">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
          Possession · Conservation
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Conservation 4v2 + appui orienté
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
            U17
          </span>
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
            18 min
          </span>
          <span className="font-mono text-[11px] text-zinc-400">EX-241</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200 bg-emerald-700 shadow-sm">
          <div className="absolute inset-0 pitch-stripes" />
          <div className="absolute inset-0 flex items-center justify-center">
            <HalfPitch className="h-full w-auto text-white/70" />
          </div>
          <svg
            viewBox="0 0 100 75"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              {[
                [28, 25],
                [55, 18],
                [72, 32],
                [45, 48],
              ].map(([x, y], i) => (
                <g key={"b" + i}>
                  <circle cx={x} cy={y} r={2.4} fill="#2f5fba" stroke="#fff" strokeWidth={0.5} />
                  <text
                    x={x}
                    y={y + 1}
                    textAnchor="middle"
                    fontSize={2.4}
                    fill="#fff"
                    fontWeight={700}
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
              {[
                [42, 30],
                [60, 38],
              ].map(([x, y], i) => (
                <g key={"r" + i}>
                  <circle cx={x} cy={y} r={2.4} fill="#c94a4a" stroke="#fff" strokeWidth={0.5} />
                </g>
              ))}
              <circle cx={80} cy={55} r={2.4} fill="#facc15" stroke="#fff" strokeWidth={0.5} />
              <text x={80} y={56} textAnchor="middle" fontSize={2.4} fill="#000" fontWeight={700}>
                A
              </text>
              <defs>
                <marker id="arrh" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                  <path d="M0,0 L0,4 L4,2 z" fill="#fff" />
                </marker>
              </defs>
              <path d="M28,25 L55,18" stroke="#fff" strokeWidth={0.7} fill="none" markerEnd="url(#arrh)" />
              <path d="M55,18 L72,32" stroke="#fff" strokeWidth={0.7} fill="none" markerEnd="url(#arrh)" />
              <path
                d="M72,32 Q76,42 80,55"
                stroke="#fff"
                strokeWidth={0.7}
                fill="none"
                strokeDasharray="1.5 1.2"
                markerEnd="url(#arrh)"
              />
              <circle cx={28} cy={25} r={1} fill="#fff" />
            </g>
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              Description
            </h3>
            <p className="text-[13px] leading-relaxed text-zinc-700">
              Carré de 20×20m. Quatre conserveurs gardent le ballon contre deux
              chasseurs. Un appui haut, à l&apos;extérieur du carré, est cherché dès
              qu&apos;une fenêtre s&apos;ouvre. Pertes = inversion des rôles.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              Organisation
            </h3>
            <p className="text-[13px] leading-relaxed text-zinc-700">
              4v2 + 1 appui. 6 plots, 4 chasubles bleu, 2 rouge, 1 jaune. 3 séries
              de 4 minutes. 90 secondes de récup. entre les séries.
            </p>
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
          Points de coaching
        </h3>
        <div className="flex flex-wrap gap-1 rounded-[10px] bg-zinc-100 p-1">
          {families.map((f) => (
            <div
              key={f.id}
              className={
                "flex flex-1 items-center justify-center gap-2 rounded-[8px] px-3 py-2 text-[12px] font-medium " +
                (f.active
                  ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
                  : "text-zinc-500")
              }
            >
              <span className="font-mono text-[10px] tabular-nums opacity-70">
                {f.id}
              </span>
              <span className="hidden sm:inline">{f.label}</span>
              <span
                className={
                  "rounded-full px-1.5 text-[10px] tabular-nums " +
                  (f.active ? "bg-zinc-100 text-zinc-700" : "bg-zinc-200 text-zinc-600")
                }
              >
                {f.count}
              </span>
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {techniquePoints.map((t, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-zinc-100 bg-white px-3 py-1.5 text-[13px] text-zinc-800 shadow-sm"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
          Variations
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold bg-amber-50 text-amber-700">
                −
              </span>
              Variation Moins
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-700">
              Carré agrandi à 25×25m, un seul chasseur. Objectif : créer du temps
              pour les jeunes joueurs.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700">
                +
              </span>
              Variation Plus
            </div>
            <p className="text-[13px] leading-relaxed text-zinc-700">
              Trois chasseurs, deux touches max., obligation d&apos;un appui avant
              la deuxième passe. Limite à 12 secondes de possession.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
