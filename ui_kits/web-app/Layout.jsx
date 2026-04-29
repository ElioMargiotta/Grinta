// Grinta — Sidebar + Topbar layout shell (theme-aware)

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { key: "teams",     label: "Teams",     icon: "users" },
  { key: "exercises", label: "Exercises", icon: "dumbbell" },
  { key: "planner",   label: "Planner",   icon: "calendar-days" },
];

// Sun / Moon icons inline
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function Sidebar({ active, onNav }) {
  const t = useTheme();
  return (
    <aside style={{
      width: 224, flexShrink: 0,
      borderRight: `1px solid ${t.border}`,
      background: t.bgSidebar,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        {/* G mark micro */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#0A1A1A"/>
          <circle cx="12" cy="12" r="8.5" stroke="#0ECECE" stroke-width="1.3"
            stroke-dasharray="40.3 13.4" stroke-dashoffset="-13.4"
            stroke-linecap="round" fill="none"/>
          <circle cx="18" cy="6" r="1.1" fill="#0ECECE"/>
          <text x="12" y="15.5" text-anchor="middle"
            font-family="'Barlow Condensed',sans-serif" font-weight="800"
            font-size="10.5" fill="#ffffff">G</text>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.fg, letterSpacing: "1px", fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase" }}>Grinta</span>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNav(item.key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                borderRadius: 6, padding: "8px 12px", fontSize: 14,
                color: isActive ? t.fgNavActive : t.fgNav,
                background: isActive ? t.bgNavActive : "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                fontWeight: isActive ? 500 : 400,
                transition: "background 0.1s, color 0.1s", textAlign: "left",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = t.bgNavHover; e.currentTarget.style.color = t.fg; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.fgNav; } }}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({ userName, dark, onToggleDark }) {
  const t = useTheme();
  return (
    <header style={{
      height: 56, borderBottom: `1px solid ${t.border}`,
      background: t.bgTopbar,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, color: t.fgMuted }}>{userName}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Theme toggle */}
        <button
          onClick={onToggleDark}
          title={dark ? "Switch to day mode" : "Switch to night mode"}
          style={{
            width: 32, height: 32, borderRadius: 6, border: `1px solid ${t.border}`,
            background: t.bgMuted, cursor: "pointer", color: t.fgMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
        <Button variant="ghost" size="sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="log-out" size={14} /> Log out
        </Button>
      </div>
    </header>
  );
}

function AppShell({ active, onNav, userName = "Alex Martin", dark, onToggleDark, children }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "inherit", overflow: "hidden", background: t.bg }}>
      <Sidebar active={active} onNav={onNav} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar userName={userName} dark={dark} onToggleDark={onToggleDark} />
        <main style={{ flex: 1, overflow: "auto", background: t.bgMain, padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { AppShell, Sidebar, Topbar });
