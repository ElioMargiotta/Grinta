"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MarkInput = {
  sessionId: string;
  playerId: string;
  status: "present" | "absent" | null;
  teamId: string;
  locale: string;
};

export async function markActualAttendanceAction({
  sessionId,
  playerId,
  status,
  teamId,
  locale,
}: MarkInput) {
  if (!sessionId || !playerId) return { error: "missing_fields" };
  if (status !== null && status !== "present" && status !== "absent") {
    return { error: "invalid_status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  if (status === null) {
    const { error } = await supabase
      .from("session_attendances")
      .update({
        actual_status: null,
        actual_marked_at: null,
        actual_marked_by: null,
      })
      .eq("session_id", sessionId)
      .eq("player_id", playerId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("session_attendances")
      .upsert(
        {
          session_id: sessionId,
          player_id: playerId,
          actual_status: status,
          actual_marked_at: new Date().toISOString(),
          actual_marked_by: user.id,
        },
        { onConflict: "session_id,player_id" },
      );
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`);
  return { ok: true };
}

export async function markAllActualAttendanceAction({
  sessionId,
  teamId,
  playerIds,
  status,
  locale,
}: {
  sessionId: string;
  teamId: string;
  playerIds: string[];
  status: "present" | "absent";
  locale: string;
}) {
  if (!sessionId || playerIds.length === 0) return { error: "missing_fields" };
  if (status !== "present" && status !== "absent") return { error: "invalid_status" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const nowIso = new Date().toISOString();
  const rows = playerIds.map((playerId) => ({
    session_id: sessionId,
    player_id: playerId,
    actual_status: status,
    actual_marked_at: nowIso,
    actual_marked_by: user.id,
  }));
  const { error } = await supabase
    .from("session_attendances")
    .upsert(rows, { onConflict: "session_id,player_id" });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`);
  return { ok: true };
}

export async function markStaffAttendanceAction({
  sessionId,
  membershipId,
  status,
  teamId,
  locale,
}: {
  sessionId: string;
  membershipId: string;
  status: "present" | "absent" | null;
  teamId: string;
  locale: string;
}) {
  if (!sessionId || !membershipId) return { error: "missing_fields" };
  if (status !== null && status !== "present" && status !== "absent") {
    return { error: "invalid_status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  if (status === null) {
    const { error } = await supabase
      .from("session_staff_attendances")
      .update({
        actual_status: null,
        actual_marked_at: null,
        actual_marked_by: null,
      })
      .eq("session_id", sessionId)
      .eq("membership_id", membershipId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("session_staff_attendances")
      .upsert(
        {
          session_id: sessionId,
          membership_id: membershipId,
          actual_status: status,
          actual_marked_at: new Date().toISOString(),
          actual_marked_by: user.id,
        },
        { onConflict: "session_id,membership_id" },
      );
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/attendance`);
  return { ok: true };
}

export async function setMembershipJsNumberAction({
  membershipId,
  jsNumber,
  teamId,
  sessionId,
  locale,
}: {
  membershipId: string;
  jsNumber: string;
  teamId: string;
  sessionId: string;
  locale: string;
}) {
  if (!membershipId) return { error: "missing_fields" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("set_membership_js_number", {
    p_membership_id: membershipId,
    p_js_number: jsNumber,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/attendance`);
  return { ok: true };
}

export async function setSessionDeadlineAction({
  sessionId,
  teamId,
  hours,
  locale,
}: {
  sessionId: string;
  teamId: string;
  hours: number;
  locale: string;
}) {
  if (!sessionId) return { error: "missing_fields" };
  const safe = Math.max(0, Math.min(168, Math.round(hours)));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase
    .from("sessions")
    .update({ rsvp_deadline_hours: safe })
    .eq("id", sessionId);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/planner/${teamId}/sessions/${sessionId}/preparation`);
  return { ok: true };
}
