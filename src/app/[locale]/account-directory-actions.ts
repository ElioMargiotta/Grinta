"use server";

import { createClient } from "@/lib/supabase/server";

export type AccountDirectoryResult = {
  userId: string;
  username: string;
  fullName: string | null;
};

export async function searchAccountDirectoryAction(
  query: string,
): Promise<AccountDirectoryResult[]> {
  const q = query.trim();
  if (q.length < 2 || q.includes("@") && !q.startsWith("@")) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_user_accounts", {
    p_query: q,
    p_limit: 8,
  });
  if (error) {
    console.error("[searchAccountDirectoryAction] failed", error);
    return [];
  }

  return (data ?? []).map(
    (row: { user_id: string; username: string; full_name: string | null }) => ({
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
    }),
  );
}
