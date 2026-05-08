"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PreparationData } from "@/components/sheet/types";

export async function savePreparationAction({
  teamId,
  sessionId,
  locale,
  data,
  sessionMeta,
}: {
  teamId: string;
  sessionId: string;
  locale: string;
  data: PreparationData;
  sessionMeta?: {
    title: string;
    startTime: string | null;
    durationMinutes: number;
  };
}) {
  if (!teamId || !sessionId) return { error: "Missing fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: session } = await supabase
    .from("sessions")
    .select("id, trainer_id")
    .eq("id", sessionId)
    .single();
  if (!session || session.trainer_id !== user.id) {
    return { error: "Not found" };
  }

  if (sessionMeta) {
    const { error: sessionError } = await supabase
      .from("sessions")
      .update({
        theme: sessionMeta.title || null,
        start_time: sessionMeta.startTime,
        duration_minutes: sessionMeta.durationMinutes,
      })
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

  revalidatePath(`/${locale}/planner/${teamId}`);
  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}`);
  revalidatePath(
    `/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`,
  );
}
