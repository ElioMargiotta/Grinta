// Notification Hub — modèle partagé client/serveur (Lot 1).
//
// Une row = une notification livrée à UN compte. Le `type` discrimine le rendu
// et l'action ; `payload` porte le contexte sérialisé (ids + libellés) pour
// éviter un round-trip à l'affichage. Voir migration 20260627120000.

export type NotificationType =
  | "match_convocation"
  | "invitation"
  | "evaluation_shared"
  | "announcement"
  | "license";

export type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  club_id: string | null;
  actor_user_id: string | null;
  read_at: string | null;
  created_at: string;
};

// Vue active du destinataire : la même notif se lit différemment côté staff
// (émetteur / suivi) et côté joueur (action à faire).
export type NotificationView = "staff" | "player";

// Audience par type : à quelle(s) vue(s) une notif appartient. Les notifs sont
// stockées par COMPTE (user_id), pas par persona — un même compte peut être à la
// fois staff et joueur lié. Sans ce filtre, une convocation (destinée au joueur)
// remonterait aussi dans la cloche du portail entraîneur. Un type absent de la
// table est affiché partout (on n'avale jamais une notif inconnue).
export const NOTIFICATION_AUDIENCE: Record<NotificationType, NotificationView[]> = {
  match_convocation: ["player"],
  evaluation_shared: ["player"],
  invitation: ["player", "staff"],
  announcement: ["player", "staff"],
  license: ["staff"],
};

/** Types explicitement HORS de cette vue (à exclure côté requête). */
export function excludedNotificationTypesForView(
  view: NotificationView,
): string[] {
  return (Object.keys(NOTIFICATION_AUDIENCE) as NotificationType[]).filter(
    (t) => !NOTIFICATION_AUDIENCE[t].includes(view),
  );
}

/** Une notif (par son type) doit-elle s'afficher dans cette vue ? */
export function isNotificationForView(
  type: string,
  view: NotificationView,
): boolean {
  const audience = NOTIFICATION_AUDIENCE[type as NotificationType];
  return audience ? audience.includes(view) : true;
}
