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
