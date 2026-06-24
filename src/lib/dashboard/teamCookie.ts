// Persistance du filtre « équipe » du tableau de bord. Le cookie stocke
// `clubId:teamId` : on ne réapplique le filtre que si le club correspond, pour
// ne pas réutiliser l'équipe d'un autre club. Partagé serveur (lecture page) et
// client (écriture WeekPanel) — d'où l'absence de `server-only`.

export const DASHBOARD_TEAM_COOKIE = "grinta_dash_team";

/** Renvoie le teamId mémorisé pour ce club, ou "all" si absent/incohérent. */
export function parseDashboardTeam(raw: string | undefined, clubId: string): string {
  if (!raw) return "all";
  const decoded = decodeURIComponent(raw);
  const sep = decoded.indexOf(":");
  if (sep === -1) return "all";
  const cid = decoded.slice(0, sep);
  const team = decoded.slice(sep + 1);
  return cid === clubId && team ? team : "all";
}
