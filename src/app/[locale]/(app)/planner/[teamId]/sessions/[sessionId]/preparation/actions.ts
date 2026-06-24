"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveMicrocycleId } from "@/app/[locale]/(app)/planner/actions";
import type { PreparationData } from "@/components/sheet/types";

export async function savePreparationAction({
  teamId,
  sessionId,
  locale,
  data,
  sessionMeta,
}: {
  teamId: string | null;
  sessionId: string;
  locale: string;
  data: PreparationData;
  sessionMeta?: {
    title: string;
    startTime: string | null;
    durationMinutes: number;
    location: string | null;
  };
}) {
  if (!sessionId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: session } = await supabase
    .from("sessions")
    .select("id, trainer_id, team_id, date, microcycle_id")
    .eq("id", sessionId)
    .single();
  if (!session || session.trainer_id !== user.id) {
    return { error: "Not found" };
  }

  // Backfill microcycle_id for sessions created before the link was wired in.
  // Solo sessions (team_id NULL) have no microcycle by design.
  let microcycleId = session.microcycle_id as string | null;
  if (!microcycleId && session.team_id && session.date) {
    microcycleId = await resolveMicrocycleId(
      supabase,
      session.team_id as string,
      session.date as string,
    );
  }

  if (sessionMeta || microcycleId !== session.microcycle_id) {
    const update: Record<string, unknown> = {};
    if (sessionMeta) {
      update.theme = sessionMeta.title || null;
      update.start_time = sessionMeta.startTime;
      update.duration_minutes = sessionMeta.durationMinutes;
      update.location = sessionMeta.location;
    }
    if (microcycleId !== session.microcycle_id) {
      update.microcycle_id = microcycleId;
    }
    const { error: sessionError } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", sessionId);
    if (sessionError) return { error: sessionError.message };
  }

  const { error } = await supabase
    .from("session_preparations")
    .upsert(
      {
        session_id: sessionId,
        trainer_id: user.id,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" },
    );

  if (error) return { error: error.message };

  if (teamId) {
    revalidatePath(`/${locale}/planner/${teamId}`);
    revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}`);
    revalidatePath(
      `/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`,
    );
  } else {
    revalidatePath(`/${locale}/sessions`);
  }
}
