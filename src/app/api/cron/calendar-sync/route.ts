import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncTeamCalendar } from "@/lib/calendar/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron Vercel — rafraîchit tous les abonnements ICS d'équipes. Vercel injecte
 * automatiquement `Authorization: Bearer $CRON_SECRET` quand un cron déclenche
 * la route (cf. `vercel.json`). En dev / appel manuel on accepte aussi un
 * header `x-cron-secret` pour pouvoir tester sans Vercel.
 *
 * Pas de retry agressif : si la sync d'une équipe échoue, l'erreur est
 * enregistrée dans `team_calendar_subscriptions.last_error` et on passe à la
 * suivante. Le prochain tick rejouera.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const headerSecret = req.headers.get("x-cron-secret");
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  if (bearer !== expected && headerSecret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: subs, error } = await supabase
    .from("team_calendar_subscriptions")
    .select("id, team_id, club_id, slot, ics_url");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let okCount = 0;
  let failCount = 0;
  for (const sub of subs ?? []) {
    const r = await syncTeamCalendar({
      supabase,
      teamId: sub.team_id as string,
      clubId: sub.club_id as string,
      source: "subscription",
      slot: sub.slot as "first_round" | "second_round" | "full",
      subscriptionId: sub.id as string,
      icsUrl: sub.ics_url as string,
    });
    if (r.ok) okCount += 1;
    else failCount += 1;
  }

  return NextResponse.json({ ok: true, processed: subs?.length ?? 0, okCount, failCount });
}
