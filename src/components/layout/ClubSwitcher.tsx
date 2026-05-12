"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { switchClubAction } from "@/app/[locale]/(app)/club-actions";
import type { ClubMembership } from "@/lib/club/types";

export function ClubSwitcher({
  current,
  memberships,
}: {
  current: ClubMembership;
  memberships: ClubMembership[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelect = (clubId: string) => {
    if (clubId === current.club_id) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("clubId", clubId);
    startTransition(async () => {
      await switchClubAction(fd);
      setOpen(false);
    });
  };

  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <Building2 className="h-4 w-4 text-zinc-500" />
        <span className="font-medium">{current.club_name}</span>
        <span className="text-xs text-zinc-500">· {current.role_name}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <Building2 className="h-4 w-4 text-zinc-500" />
        <span className="font-medium">{current.club_name}</span>
        <span className="text-xs text-zinc-500">· {current.role_name}</span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <div
          className="absolute left-0 z-40 mt-1 w-72 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          onMouseLeave={() => setOpen(false)}
        >
          <ul className="max-h-80 overflow-y-auto py-1">
            {memberships.map((m) => {
              const active = m.club_id === current.club_id;
              return (
                <li key={m.club_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(m.club_id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {m.club_name}
                      </span>
                      <span className="truncate text-xs text-zinc-500">
                        {m.role_name}
                      </span>
                    </div>
                    {active && <Check className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
