// Grinta — Dashboard screen (theme-aware)

function Dashboard({ onNav }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.fg, letterSpacing: "-0.015em" }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: t.fgMuted, marginTop: 4 }}>Welcome back, Alex.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card style={{ cursor: "pointer" }} onClick={() => onNav("teams")}>
          <div style={{ fontSize: 13, color: t.fgMuted }}>Teams</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: t.fg, marginTop: 6 }}>3</div>
        </Card>
        <Card style={{ cursor: "pointer" }} onClick={() => onNav("exercises")}>
          <div style={{ fontSize: 13, color: t.fgMuted }}>Exercises</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: t.fg, marginTop: 6 }}>24</div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: t.fgMuted }}>Next session</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: t.fg, marginTop: 6 }}>Thu 15 Aug · 10:00</div>
          <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 2 }}>U17 Phoenix — Tactical pressing</div>
        </Card>
      </div>

      {/* Recent sessions */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: t.fg }}>Recent sessions</h2>
          <Button variant="ghost" size="sm" onClick={() => onNav("planner")}>
            View planner <Icon name="chevron-right" size={14} />
          </Button>
        </div>
        <Card style={{ padding: 0 }}>
          {[
            { date: "Mon 12 Aug", time: "09:00", theme: "Pressing patterns", team: "U17 Phoenix", dur: 90 },
            { date: "Wed 10 Aug", time: "10:30", theme: "Set pieces", team: "U17 Phoenix", dur: 75 },
            { date: "Fri 8 Aug",  time: "08:00", theme: "Warmup & rondos", team: "U15 Falcons", dur: 60 },
          ].map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: i < 2 ? `1px solid ${t.divider}` : "none",
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.theme}</div>
                <div style={{ fontSize: 12, color: t.fgMuted, marginTop: 2 }}>{s.team}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ fontSize: 13, color: t.fgMuted }}>{s.date} · {s.time}</div>
                <div style={{ fontSize: 12, color: t.fgSubtle, marginTop: 2 }}>{s.dur} min</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
