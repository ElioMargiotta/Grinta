"use server";

import { createClient } from "@/lib/supabase/server";

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    return { errorCode: "passwordTooShort" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Recovery session expired or the page was opened directly.
    return { errorCode: "noSession" as const };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  return { success: true as const };
}
