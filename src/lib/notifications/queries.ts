import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  excludedNotificationTypesForView,
  type NotificationRow,
  type NotificationView,
} from "./types";

const NOTIFICATION_COLUMNS =
  "id, type, payload, club_id, actor_user_id, read_at, created_at";

// Les valeurs de `type` exclues sont des identifiants statiques (jamais de
// l'input client) → interpolation sûre dans le filtre PostgREST `in`.
function excludedInList(view: NotificationView): string | null {
  const excluded = excludedNotificationTypesForView(view);
  return excluded.length === 0 ? null : `(${excluded.join(",")})`;
}

/**
 * Notifications récentes du compte courant, anté-chronologiques, filtrées sur
 * l'audience de la vue (le portail entraîneur ne voit pas les notifs joueur, et
 * inversement). RLS scope implicitement sur auth.uid().
 */
export async function listRecentNotifications(
  view: NotificationView,
  limit = 20,
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  const excluded = excludedInList(view);
  if (excluded) query = query.not("type", "in", excluded);
  const { data } = await query;
  return (data as NotificationRow[] | null) ?? [];
}

/** Nombre de notifications non lues du compte courant pour la vue (badge). */
export async function getUnreadNotificationCount(
  view: NotificationView,
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const excluded = excludedInList(view);
  if (excluded) query = query.not("type", "in", excluded);
  const { count } = await query;
  return count ?? 0;
}
