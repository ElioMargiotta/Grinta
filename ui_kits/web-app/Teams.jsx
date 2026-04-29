// Grinta — Teams screen (theme-aware)

const SAMPLE_TEAMS = [
  { id: 1, name: "U17 Phoenix",  season: "2024–2025", ageGroup: "U17", players: 18 },
  { id: 2, name: "U15 Falcons",  season: "2024–2025", ageGroup: "U15", players: 15 },
  { id: 3, name: "U13 Strikers", season: "2024–2025", ageGroup: "U13", players: 14 },
];

const SAMPLE_PLAYERS = [
  { firstName: "Lucas",  lastName: "Martin",   position: "Goalkeeper", jersey: 1,  birthDate: "2008-03-15" },
  { firstName: "Noah",   lastName: "Bernard",  position: "Defender",   jersey: 5,  birthDate: "2007-07-22" },
  { firstName: "Ethan",  lastName: "Rousseau", position: "Midfielder",  jersey: 8,  birthDate: "2008-01-10" },
  { firstName: "Liam",   lastName: "Dupont",   position: "Forward",    jersey: 9,  birthDate: "2007-11-05" },
  { firstName: "Oliver", lastName: "Leroy",    position: "Midfielder",  jersey: 10, birthDate: "2008-06-18" },
];

function backBtn(t, onClick, label) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      color: t.fgMuted, fontSize: 14, marginBottom: 20,
      padding: 0, fontFamily: "inherit",
    }}>
      <Icon name="arrow-left" size={14} /> {label}
    </button>
  );
}

function Teams({ onNav }) {
  const t = useTheme();
  const [view, setView] = React.useState("list");
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [showNewPlayer, setShowNewPlayer] = React.useState(false);

  if (view === "new") {
    return (
      <div style={{ maxWidth: 480 }}>
        {backBtn(t, () => setView("list"), "Back to teams")}
        <h1 style={{ fontSize: 20, fontWeight: 600, color: t.fg, marginBottom: 20 }}>New team</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Team name" id="tname" placeholder="e.g. U17 Phoenix" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Season" id="tseason" defaultValue="2024–2025" />
            <Input label="Age group" id="tage" placeholder="e.g. U17" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Button>Create team</Button>
            <Button variant="ghost" onClick={() => setView("list")}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "detail" && selectedTeam) {
    return (
      <div style={{ maxWidth: 700 }}>
        {backBtn(t, () => setView("list"), "All teams")}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: t.fg }}>{selectedTeam.name}</h1>
            <p style={{ fontSize: 13, color: t.fgMuted, marginTop: 2 }}>{selectedTeam.season} · {selectedTeam.ageGroup}</p>
          </div>
          <Button size="sm" onClick={() => setShowNewPlayer(!showNewPlayer)}>
            <Icon name="plus" size={13} /> Add player
          </Button>
        </div>

        {showNewPlayer && (
          <Card style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: t.fg }}>Add player</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Input label="First name" id="pfn" placeholder="Lucas" />
              <Input label="Last name"  id="pln" placeholder="Martin" />
              <Input label="Position"   id="ppos" placeholder="Midfielder" />
              <Input label="Jersey #"   id="pjer" type="number" placeholder="10" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm">Add player</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewPlayer(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        <Card style={{ padding: 0 }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.divider}`, display: "grid", gridTemplateColumns: "32px 1fr 120px 80px", gap: 8 }}>
            {["#","Name","Position","Born"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 500, color: t.fgSubtle }}>{h}</span>
            ))}
          </div>
          {SAMPLE_PLAYERS.map((p, i) => (
            <div key={i} style={{
              padding: "10px 16px", display: "grid", gridTemplateColumns: "32px 1fr 120px 80px",
              gap: 8, borderBottom: i < SAMPLE_PLAYERS.length - 1 ? `1px solid ${t.divider}` : "none",
              fontSize: 14,
            }}>
              <span style={{ color: t.fgSubtle, fontWeight: 500 }}>{p.jersey}</span>
              <span style={{ color: t.fg, fontWeight: 500 }}>{p.firstName} {p.lastName}</span>
              <span style={{ color: t.fgMuted }}>{p.position}</span>
              <span style={{ color: t.fgSubtle, fontSize: 12 }}>{p.birthDate}</span>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: t.fg, letterSpacing: "-0.015em" }}>Teams</h1>
        <Button size="sm" onClick={() => setView("new")}><Icon name="plus" size={13} /> New team</Button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SAMPLE_TEAMS.map(team => (
          <Card key={team.id} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => { setSelectedTeam(team); setView("detail"); }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.fg }}>{team.name}</div>
              <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 2 }}>{team.season} · {team.ageGroup} · {team.players} players</div>
            </div>
            <Icon name="chevron-right" size={16} style={{ color: t.fgSubtle }} />
          </Card>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Teams });
