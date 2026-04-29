// Grinta — Theme context (light / dark)

const LIGHT = {
  // Backgrounds
  bg:          "#ffffff",
  bgSubtle:    "#fafafa",
  bgMuted:     "#f4f4f5",
  bgCard:      "#ffffff",
  bgInput:     "#ffffff",
  bgSidebar:   "#ffffff",
  bgTopbar:    "#ffffff",
  bgNavActive: "#ecfffe",
  bgNavHover:  "#fafafa",
  bgMain:      "#fafafa",

  // Foregrounds
  fg:          "#18181b",
  fgMuted:     "#71717a",
  fgSubtle:    "#a1a1aa",
  fgNav:       "#52525b",
  fgNavActive: "#056868",

  // Borders
  border:      "#e4e4e7",
  borderInput: "#d4d4d8",
  borderFocus: "#0ECECE",

  // Brand
  primary:       "#0ECECE",
  primaryHover:  "#0aacac",
  primaryFg:     "#0A1A1A",
  primaryFgHover:"#ffffff",

  // Danger
  danger:      "#dc2626",
  dangerHover: "#b91c1c",

  // Secondary button
  secondary:      "#f4f4f5",
  secondaryHover: "#e4e4e7",
  secondaryFg:    "#18181b",

  // Divider
  divider: "#f4f4f5",

  // Mode flag
  dark: false,
};

const DARK = {
  bg:          "#0A1A1A",
  bgSubtle:    "#091515",
  bgMuted:     "#0d2020",
  bgCard:      "#0d2020",
  bgInput:     "#0d2020",
  bgSidebar:   "#0A1A1A",
  bgTopbar:    "#0A1A1A",
  bgNavActive: "#0d3030",
  bgNavHover:  "#0d2525",
  bgMain:      "#091515",

  fg:          "#e8fafa",
  fgMuted:     "#5aabab",
  fgSubtle:    "#3a7a7a",
  fgNav:       "#5aabab",
  fgNavActive: "#0ECECE",

  border:      "#1a3535",
  borderInput: "#1e3535",
  borderFocus: "#0ECECE",

  primary:       "#0ECECE",
  primaryHover:  "#32edea",
  primaryFg:     "#0A1A1A",
  primaryFgHover:"#0A1A1A",

  danger:      "#ef4444",
  dangerHover: "#dc2626",

  secondary:      "#1a3535",
  secondaryHover: "#1e3a3a",
  secondaryFg:    "#e8fafa",

  divider: "#1a3535",

  dark: true,
};

// React context
const ThemeContext = React.createContext(LIGHT);
window.useTheme = () => React.useContext(ThemeContext);
window.ThemeProvider = function ThemeProvider({ dark, children }) {
  const t = dark ? DARK : LIGHT;
  return React.createElement(ThemeContext.Provider, { value: t }, children);
};

window.LIGHT_THEME = LIGHT;
window.DARK_THEME  = DARK;
