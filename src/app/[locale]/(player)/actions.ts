"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type RespondInput = {
  sessionId: string;
  status: "present" | "absent";
  reason?: string;
  locale: string;
};

const ERROR_KEYS = new Set([
  "unauthenticated",
  "reason_required_when_absent",
  "session_not_found",
  "club_inactive",
  "not_assigned_to_team",
  "deadline_passed",
]);

export async function respondToSessionAction({
  sessionId,
  status,
  reason,
  locale,
}: RespondInput) {
  if (!sessionId) return { error: "missing_session" };
  if (status !== "present" && status !== "absent") return { error: "invalid_status" };
  if (status === "absent") {
    const trimmed = (reason ?? "").trim();
    if (!trimmed) return { error: "reason_required_when_absent" };
    reason = trimmed.slice(0, 500);
  } else {
    reason = undefined;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("respond_to_session", {
    p_session_id: sessionId,
    p_status: status,
    p_reason: reason ?? null,
  });

  if (error) {
    const code = ERROR_KEYS.has(error.message) ? error.message : "unknown";
    return { error: code };
  }

  revalidatePath(`/${locale}/schedule`);
  return { ok: true };
}

type RespondMatchInput = {
  matchId: string;
  status: "available" | "unavailable";
  reason?: string;
  locale: string;
};

const MATCH_ERROR_KEYS = new Set([
  "unauthenticated",
  "invalid_status",
  "reason_required_when_unavailable",
  "match_not_found",
  "club_inactive",
  "match_finished",
  "not_assigned_to_team",
  "not_called_up",
]);

export async function respondToMatchAction({
  matchId,
  status,
  reason,
  locale,
}: RespondMatchInput) {
  if (!matchId) return { error: "missing_match" };
  if (status !== "available" && status !== "unavailable") {
    return { error: "invalid_status" };
  }
  if (status === "unavailable") {
    const trimmed = (reason ?? "").trim();
    if (!trimmed) return { error: "reason_required_when_unavailable" };
    reason = trimmed.slice(0, 500);
  } else {
    reason = undefined;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { error } = await supabase.rpc("respond_to_match", {
    p_match_id: matchId,
    p_status: status,
    p_reason: reason ?? null,
  });

  if (error) {
    const code = MATCH_ERROR_KEYS.has(error.message) ? error.message : "unknown";
    return { error: code };
  }

  revalidatePath(`/${locale}/schedule`);
  return { ok: true };
}
