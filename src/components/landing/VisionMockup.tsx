const THEME_DOT: Record<string, { dot: string; label: string }> = {
  possede: { dot: "#16a34a", label: "Mon équipe possède le ballon" },
  ne_possede_pas: { dot: "#dc2626", label: "Mon équipe ne possède pas le ballon" },
  recupere: { dot: "#2563eb", label: "Mon équipe récupère le ballon" },
  perd: { dot: "#d97706", label: "Mon équipe perd le ballon" },
};

export function VisionMockup() {
  const tiers = [
    {
      name: "Équipe première",
      level: "Senior",
      players: 24,
      sessions: 6,
      accent: true,
    },
    { name: "Réserve", level: "U23", players: 22, sessions: 4 },
    { name: "U19 Nationaux", level: "U19", players: 22, sessions: 5 },
    { name: "U17 Nationaux", level: "U17", players: 22, sessions: 4 },
    { name: "U15 Régional", level: "U15", players: 20, sessions: 3 },
    { name: "U13 Pré-formation", level: "U13", players: 18, sessions: 3 },
  ];
  const themes = ["possede", "ne_possede_pas", "recupere", "perd", "possede", "ne_possede_pas"] as const;
  const charges = [82, 70, 78, 64, 56, 50];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden text-zinc-900">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Vision Club
          </div>
          <div className="text-[14px] font-semibold tracking-tight">
            FC Exemple · Saison 25–26
          </div>
        </div>
        <div className="text-[11px] font-mono text-zinc-500">128 joueurs · 6 catégories</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-200 text-[11px]">
        {[
          ["Système", "1-4-3-3"],
          ["Possession", "Construction par l'axe"],
          ["Pressing", "Déclencheurs à mi-terrain"],
          ["Transitions", "Réaction perte 5s"],
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

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-[12.5px]">
          <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">Catégorie</th>
              <th className="px-4 py-2 text-left">Joueurs</th>
              <th className="px-4 py-2 text-left">Thème de la semaine</th>
              <th className="px-4 py-2 text-left">Charge S+2</th>
              <th className="px-4 py-2 text-right">Séances</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => {
              const th = THEME_DOT[themes[i]];
              return (
                <tr
                  key={t.name}
                  className={
                    "border-t border-zinc-200 " +
                    (t.accent ? "bg-emerald-50/40" : "")
                  }
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] w-8 text-zinc-400">
                        {t.level}
                      </span>
                      <span className="font-medium">{t.name}</span>
                      {t.accent && (
                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">
                          référence
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 font-mono">{t.players}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: th.dot }}
                      />
                      <span className="text-zinc-700">{th.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-zinc-200 overflow-hidden">
                        <span
                          className="block h-full"
                          style={{
                            width: charges[i] + "%",
                            background: "#2f5fba",
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {charges[i]}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-700">
                    {t.sessions}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
