// Grinta — Exercises screen (theme-aware)

const SAMPLE_EXERCISES = [
  { id: 1, name: "Rondo 4v2",           category: "technical", duration: 15, intensity: "high",   description: "Possession drill in a small space, 4 attackers vs 2 defenders." },
  { id: 2, name: "Pressing trigger",    category: "tactical",  duration: 20, intensity: "high",   description: "Teams practice coordinated press triggers from a set cue." },
  { id: 3, name: "Dynamic warmup",      category: "warmup",    duration: 12, intensity: "low",    description: "Activation drills: leg swings, high knees, lateral shuffles." },
  { id: 4, name: "Crossing & finishing",category: "technical", duration: 18, intensity: "medium", description: "Wide players cross into box while strikers time their runs." },
  { id: 5, name: "Box-to-box runs",     category: "physical",  duration: 10, intensity: "high",   description: "Repeated end-to-end shuttles to build aerobic capacity." },
  { id: 6, name: "Cooldown stretch",    category: "cooldown",  duration: 8,  intensity: "low",    description: "Static stretches focusing on quads, hamstrings and hip flexors." },
];

const CATEGORIES = ["all", "warmup", "technical", "tactical", "physical", "cooldown"];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function Exercises() {
  const t = useTheme();
  const [filter, setFilter] = React.useState("all");
  const [view, setView]     = React.useState("list");
  const [selected, setSelected] = React.useState(null);
  const [search, setSearch] = React.useState("");

  const visible = SAMPLE_EXERCISES.filter(e =>
    (filter === "all" || e.category === filter) &&
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const backBtn = (label, onClick) => (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      color: t.fgMuted, fontSize: 14, marginBottom: 20, padding: 0, fontFamily: "inherit",
    }}>
      <Icon name="arrow-left" size={14} /> {label}
    </button>
  );

  if (view === "new") {
    return (
      <div style={{ maxWidth: 520 }}>
        {backBtn("Exercise library", () => setView("list"))}
        <h1 style={{ fontSize: 20, fontWeight: 600, color: t.fg, marginBottom: 20 }}>New exercise</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Name" id="ename" placeholder="e.g. Rondo 4v2" />
          <Textarea label="Description" id="edesc" placeholder="Describe the exercise…" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select label="Category" id="ecat">
              <option>Warmup</option><option>Technical</option><option>Tactical</option>
              <option>Physical</option><option>Cooldown</option>
            </Select>
            <Select label="Intensity" id="eint">
              <option>Low</option><option>Medium</option><option>High</option>
            </Select>
            <Input label="Duration (min)" id="edur" type="number" placeholder="15" />
            <Input label="Equipment" id="eeq" placeholder="Cones, balls" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Button>Save exercise</Button>
            <Button variant="ghost" onClick={() => setView("list")}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "detail" && selected) {
    return (
      <div style={{ maxWidth: 520 }}>
        {backBtn("Exercise library", () => setView("list"))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: t.fg }}>{selected.name}</h1>
          <Button size="sm" variant="danger"><Icon name="trash-2" size={13} /> Delete</Button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <Badge variant={selected.category}>{cap(selected.category)}</Badge>
          <Badge variant={selected.intensity}>{cap(selected.intensity)}</Badge>
          <Badge>{selected.duration} min</Badge>
        </div>
        <Card>
          <p style={{ fontSize: 14, color: t.fgMuted, lineHeight: 1.6 }}>{selected.description}</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.fg, letterSpacing: "-0.015em" }}>Exercise library</h1>
        <Button size="sm" onClick={() => setView("new")}><Icon name="plus" size={13} /> New exercise</Button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.fgSubtle, display: "flex" }}>
            <Icon name="search" size={14} />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            style={{
              width: "100%", height: 36, borderRadius: 6,
              border: `1px solid ${t.borderInput}`,
              background: t.bgInput, paddingLeft: 32, paddingRight: 12,
              fontFamily: "inherit", fontSize: 13, color: t.fg, outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              height: 36, padding: "0 12px", borderRadius: 6, fontSize: 13,
              fontFamily: "inherit", fontWeight: filter === c ? 500 : 400,
              background: filter === c ? t.primary : t.bgCard,
              color: filter === c ? t.primaryFg : t.fgMuted,
              border: `1px solid ${t.border}`, cursor: "pointer",
              transition: "background 0.12s",
            }}>
              {c === "all" ? "All" : cap(c)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.length === 0 && <p style={{ fontSize: 14, color: t.fgMuted }}>No exercises found.</p>}
        {visible.map(ex => (
          <Card key={ex.id}
            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}
            onClick={() => { setSelected(ex); setView("detail"); }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>{ex.name}</div>
              <div style={{ fontSize: 12, color: t.fgMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.description.slice(0, 60)}…</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
              <Badge variant={ex.category}>{cap(ex.category)}</Badge>
              <Badge variant={ex.intensity}>{ex.intensity}</Badge>
              <span style={{ fontSize: 12, color: t.fgSubtle, marginLeft: 4 }}>{ex.duration} min</span>
              <Icon name="chevron-right" size={14} style={{ color: t.fgSubtle }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Exercises });
