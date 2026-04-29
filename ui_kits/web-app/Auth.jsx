// Grinta — Auth screens (theme-aware)

function Auth({ onLogin }) {
  const t = useTheme();
  const [tab, setTab]       = React.useState("login");
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (tab === "signup") setTab("check");
      else onLogin();
    }, 900);
  }

  const authWrap = {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", background: t.bgSubtle,
  };
  const authCard = {
    width: 380, background: t.bgCard, border: `1px solid ${t.border}`,
    borderRadius: 12, padding: 32,
  };

  if (tab === "check") {
    return (
      <div style={authWrap}>
        <div style={authCard}>
          <LogoMark t={t} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: t.fg }}>Check your inbox</h2>
          <p style={{ fontSize: 14, color: t.fgMuted, lineHeight: 1.6, marginTop: 6 }}>
            We sent a confirmation link to your email. Click it to activate your account.
          </p>
          <button onClick={() => setTab("login")} style={{ background: "none", border: "none", cursor: "pointer", color: t.primary, fontWeight: 500, fontSize: 14, fontFamily: "inherit", padding: 0, marginTop: 20 }}>
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={authWrap}>
      <div style={authCard}>
        <LogoMark t={t} />

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, background: t.bgMuted, borderRadius: 8, padding: 3, marginBottom: 24 }}>
          {["login", "signup"].map(tab_ => (
            <button key={tab_} onClick={() => setTab(tab_)} style={{
              flex: 1, height: 32, borderRadius: 6, fontSize: 13, fontFamily: "inherit",
              fontWeight: tab === tab_ ? 500 : 400,
              background: tab === tab_ ? t.bgCard : "transparent",
              color: tab === tab_ ? t.fg : t.fgMuted,
              border: "none", cursor: "pointer",
              boxShadow: tab === tab_ ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.12s",
            }}>
              {tab_ === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: t.fg }}>
            {tab === "login" ? "Welcome back" : "Create your trainer account"}
          </h2>
          <p style={{ fontSize: 14, color: t.fgMuted, marginTop: 4 }}>
            {tab === "login" ? "Log in to plan your team's training." : "Set up your account in 30 seconds."}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "signup" && <Input label="Full name" id="fullname" placeholder="Alex Martin" />}
          <Input label="Email" id="email" type="email" placeholder="coach@club.com" />

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="password" style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPw ? "text" : "password"}
                placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
                style={{
                  width: "100%", height: 40, borderRadius: 6,
                  border: `1px solid ${t.borderInput}`,
                  background: t.bgInput, padding: "0 40px 0 12px",
                  fontFamily: "inherit", fontSize: 14, color: t.fg,
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: t.fgMuted, display: "flex", padding: 2,
              }}>
                <Icon name="eye" size={14} />
              </button>
            </div>
            <span style={{ fontSize: 12, color: t.fgMuted }}>
              {tab === "signup" ? "At least 6 characters." : "The password you chose at signup."}
            </span>
          </div>

          <Button type="submit" style={{ marginTop: 4, width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading
              ? (tab === "login" ? "Logging in…" : "Creating account…")
              : (tab === "login" ? "Log in" : "Create account")}
          </Button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: t.fgMuted }}>
          {tab === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => setTab(tab === "login" ? "signup" : "login")}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.primary, fontWeight: 500, fontSize: "inherit", fontFamily: "inherit", padding: 0 }}
          >
            {tab === "login" ? "Create one" : "Log in instead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoMark({ t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="8" fill="#0A1A1A"/>
        <circle cx="14" cy="14" r="10" stroke="#0ECECE" strokeWidth="1.8"
          strokeDasharray="47.1 15.7" strokeDashoffset="-15.7"
          strokeLinecap="round" fill="none"/>
        <circle cx="21" cy="7" r="1.3" fill="#0ECECE"/>
        <text x="14" y="18.5" textAnchor="middle"
          fontFamily="'Barlow Condensed', sans-serif" fontWeight="800"
          fontSize="13" fill="#ffffff">G</text>
      </svg>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: "2px", textTransform: "uppercase", color: t.fg }}>GRINTA</span>
    </div>
  );
}

Object.assign(window, { Auth });
