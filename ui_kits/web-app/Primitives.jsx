// Grinta — shared UI primitives (theme-aware)

const BTN_BASE = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 6, borderRadius: 6, fontFamily: "inherit", fontSize: 14, fontWeight: 500,
  cursor: "pointer", border: "none", transition: "background 0.12s, color 0.12s",
  outline: "none",
};
const BTN_SIZES = {
  md: { height: 40, padding: "0 16px" },
  sm: { height: 32, padding: "0 10px", fontSize: 13 },
};

function Button({ children, variant = "primary", size = "md", style = {}, disabled, ...props }) {
  const t = useTheme();
  const [hover, setHover] = React.useState(false);

  const variants = {
    primary:   { background: hover ? t.primaryHover   : t.primary,   color: hover ? t.primaryFgHover : t.primaryFg },
    secondary: { background: hover ? t.secondaryHover : t.secondary, color: t.secondaryFg },
    ghost:     { background: hover ? t.bgMuted        : "transparent", color: t.fgNav },
    danger:    { background: hover ? t.dangerHover    : t.danger,   color: "#fff" },
  };

  return (
    <button
      disabled={disabled}
      style={{
        ...BTN_BASE, ...variants[variant], ...BTN_SIZES[size],
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...props}
    >{children}</button>
  );
}

function Input({ label, id, type = "text", style = {}, containerStyle = {}, ...props }) {
  const t = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...containerStyle }}>
      {label && <label htmlFor={id} style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>{label}</label>}
      <input
        id={id} type={type}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          height: 40, borderRadius: 6,
          border: `1px solid ${focus ? t.borderFocus : t.borderInput}`,
          background: t.bgInput, padding: "0 12px", fontFamily: "inherit",
          fontSize: 14, color: t.fg, outline: "none",
          transition: "border-color 0.12s", ...style,
        }}
        {...props}
      />
    </div>
  );
}

function Select({ label, id, children, style = {}, ...props }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label htmlFor={id} style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>{label}</label>}
      <select id={id} style={{
        height: 40, borderRadius: 6, border: `1px solid ${t.borderInput}`,
        background: t.bgInput, padding: "0 12px", fontFamily: "inherit",
        fontSize: 14, color: t.fg, outline: "none", cursor: "pointer", ...style,
      }} {...props}>{children}</select>
    </div>
  );
}

function Textarea({ label, id, style = {}, ...props }) {
  const t = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label htmlFor={id} style={{ fontSize: 14, fontWeight: 500, color: t.fg }}>{label}</label>}
      <textarea
        id={id}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          minHeight: 80, borderRadius: 6,
          border: `1px solid ${focus ? t.borderFocus : t.borderInput}`,
          background: t.bgInput, padding: "10px 12px", fontFamily: "inherit",
          fontSize: 14, color: t.fg, outline: "none", resize: "vertical",
          transition: "border-color 0.12s", ...style,
        }}
        {...props}
      />
    </div>
  );
}

function Card({ children, style = {}, onClick }) {
  const t = useTheme();
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 8, border: `1px solid ${t.border}`,
        background: t.bgCard, padding: 16, ...style,
      }}
    >{children}</div>
  );
}

function Badge({ children, variant = "neutral" }) {
  const t = useTheme();
  const variants = {
    neutral:   { background: t.bgMuted,    color: t.fgMuted },
    warmup:    { background: t.dark ? "#2a1a00" : "#fef9c3", color: t.dark ? "#f5b942" : "#854d0e" },
    technical: { background: t.dark ? "#001a3a" : "#dbeafe", color: t.dark ? "#60a5fa" : "#1e40af" },
    tactical:  { background: t.dark ? "#002a12" : "#dcfce7", color: t.dark ? "#4ade80" : "#166534" },
    physical:  { background: t.dark ? "#2a0020" : "#fce7f3", color: t.dark ? "#f472b6" : "#9d174d" },
    cooldown:  { background: t.dark ? "#001a2a" : "#e0f2fe", color: t.dark ? "#38bdf8" : "#075985" },
    high:      { background: t.dark ? "#0d3535" : "#18181b", color: t.dark ? "#0ECECE" : "#fff" },
    medium:    { background: t.bgMuted,    color: t.fg },
    low:       { background: t.bgSubtle,   color: t.fgMuted },
  };
  const s = variants[variant] || variants.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 4,
      padding: "2px 8px", fontSize: 11, fontWeight: 500, ...s,
    }}>{children}</span>
  );
}

Object.assign(window, { Button, Input, Select, Textarea, Card, Badge });
