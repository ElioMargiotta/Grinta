// Grinta — Planner screen (theme-aware)

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const SESSIONS = {
  "2025-08-04": [{ theme: "Warmup & rondos",       team: "U15 Falcons",  time: "09:00" }],
  "2025-08-07": [{ theme: "Set pieces",            team: "U17 Phoenix",  time: "10:30" }],
  "2025-08-11": [{ theme: "Pressing patterns",     team: "U17 Phoenix",  time: "09:00" }],
  "2025-08-13": [{ theme: "Physical conditioning", team: "U13 Strikers", time: "15:00" }],
  "2025-08-15": [{ theme: "Tactical pressing",     team: "U17 Phoenix",  time: "10:00" }],
  "2025-08-18": [{ theme: "Crossing & finishing",  team: "U15 Falcons",  time: "09:00" }],
  "2025-08-20": [{ theme: "Rondo intensive",       team: "U17 Phoenix",  time: "11:00" }],
  "2025-08-25": [
    { theme: "Match simulation", team: "U17 Phoenix",  time: "09:30" },
    { theme: "Cooldown & review",team: "U15 Falcons",  time: "15:00" },
  ],
};

function Planner() {
  const t = useTheme();
  const [year, setYear]   = React.useState(2025);
  const [month, setMonth] = React.useState(7);
  const [view, setView]   = React.useState("month");
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [selectedSession, setSelectedSession] = React.useState(null);

  const firstDay  = new Date(year, month, 1);
  const startDow  = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad     = n => String(n).padStart(2, "0");
  const dateKey = d => `${year}-${pad(month + 1)}-${pad(d)}`;
  const today   = "2025-08-15";

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const backBtn = (
    <button onClick={() => setView("month")} style={{
      background: "none", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      color: t.fgMuted, fontSize: 14, marginBottom: 20, padding: 0, fontFamily: "inherit",
    }}>
      <Icon name="arrow-left" size={14} /> Back to planner
    </button>
  );

  if (view === "session" && selectedSession) {
    const sess = selectedSession;
    return (
      <div style={{ maxWidth: 520 }}>
        {backBtn}
        <h1 style={{ fontSize: 20, fontWeight: 600, color: t.fg, marginBottom: 4 }}>{sess.theme}</h1>
        <p style={{ fontSize: 13, color: t.fgMuted, marginBottom: 20 }}>{sess.team} · {selectedDate} · {sess.time}</p>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Start time", sess.time], ["Duration", "90 min"], ["Theme", sess.theme], ["Team", sess.team]].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: t.fgSubtle }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: t.fg }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: t.fg, marginBottom: 10 }}>Exercises</h3>
        <Card style={{ padding: 0 }}>
          {["Dynamic warmup · 12 min · Low","Rondo 4v2 · 15 min · High","Pressing trigger · 20 min · High","Cooldown stretch · 8 min · Low"].map((e, i, arr) => (
            <div key={i} style={{
              padding: "10px 16px",
              borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : "none",
              fontSize: 14, color: t.fg,
            }}>{e}</div>
          ))}
        </Card>
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <Button size="sm" variant="secondary">Edit session</Button>
          <Button size="sm" variant="danger"><Icon name="trash-2" size={13} /> Delete</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.fg, letterSpacing: "-0.015em" }}>Season planner</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {["Year","Month","Week","Day"].map(v => (
            <button key={v} onClick={() => {}} style={{
              height: 32, padding: "0 12px", borderRadius: 6, fontSize: 13, fontFamily: "inherit",
              background: v === "Month" ? t.primary : t.bgCard,
              color: v === "Month" ? t.primaryFg : t.fgMuted,
              border: `1px solid ${t.border}`, cursor: "pointer",
            }}>{v}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Select id="team-select" style={{ width: 200 }}>
          <option>U17 Phoenix</option>
          <option>U15 Falcons</option>
          <option>U13 Strikers</option>
        </Select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.fgMuted, display: "flex", padding: 4 }}>
          <Icon name="chevron-left" size={16} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: t.fg, minWidth: 140, textAlign: "center" }}>
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", color: t.fgMuted, display: "flex", padding: 4 }}>
          <Icon name="chevron-right" size={16} />
        </button>
        <Button size="sm" style={{ marginLeft: "auto" }}><Icon name="plus" size={13} /> New session</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: "6px 8px", fontSize: 11, fontWeight: 500, color: t.fgSubtle, textAlign: "center" }}>{d}</div>
        ))}
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1,
        background: t.border, border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden",
      }}>
        {cells.map((day, i) => {
          const key      = day ? dateKey(day) : null;
          const sessions = key && SESSIONS[key];
          const isToday  = key === today;
          return (
            <div key={i}
              onClick={() => { if (day && sessions) { setSelectedDate(key); setSelectedSession(sessions[0]); setView("session"); } }}
              style={{ background: t.bgCard, minHeight: 72, padding: "6px 8px", cursor: day && sessions ? "pointer" : "default" }}>
              {day && (
                <>
                  <div style={{
                    fontSize: 13, fontWeight: isToday ? 600 : 400,
                    color: isToday ? "#fff" : t.fg,
                    background: isToday ? t.primary : "transparent",
                    borderRadius: "50%", width: 22, height: 22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 4,
                  }}>{day}</div>
                  {sessions && sessions.map((s, si) => (
                    <div key={si} style={{
                      fontSize: 11, fontWeight: 500,
                      background: t.dark ? "#0d3535" : "#ecfffe",
                      color: t.dark ? "#0ECECE" : "#056868",
                      borderRadius: 3, padding: "2px 5px", marginBottom: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{s.theme}</div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Planner });
