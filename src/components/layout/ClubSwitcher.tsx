"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Building2 } from "lucide-react";
import { switchClubAction } from "@/app/[locale]/(app)/club-actions";
import { useLoading } from "@/components/ui/LoadingProvider";
import type { ClubMembership } from "@/lib/club/types";

function ClubMark({ membership }: { membership: ClubMembership }) {
  if (membership.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={membership.logo_url}
        alt={membership.club_name}
        className="h-6 w-6 shrink-0 rounded-sm object-contain"
      />
    );
  }

  return <Building2 className="h-4 w-4 shrink-0 text-[var(--club-primary)]" />;
}

export function ClubSwitcher({
  current,
  memberships,
}: {
  current: ClubMembership;
  memberships: ClubMembership[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { run } = useLoading();
  const tCommon = useTranslations("common");

  const handleSelect = (clubId: string) => {
    if (clubId === current.club_id) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("clubId", clubId);
    startTransition(async () => {
      await run(() => switchClubAction(fd), {
        label: tCommon("loading"),
        message: tCommon("pleaseWait"),
      });
      setOpen(false);
    });
  };

  if (memberships.length <= 1) {
    return (
      <div className="flex max-w-52 items-center gap-1.5 rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-xs text-zinc-900 lg:max-w-64 lg:gap-2 lg:px-3 lg:text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <ClubMark membership={current} />
        <span className="truncate font-medium">{current.club_name}</span>
        <span className="hidden shrink-0 text-xs text-zinc-500 xl:inline">· {current.role_name}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-52 items-center gap-1.5 rounded-md border border-[var(--club-line)] bg-white px-2 py-1.5 text-xs text-zinc-900 hover:bg-[var(--club-primary-soft)] lg:max-w-64 lg:gap-2 lg:px-3 lg:text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <ClubMark membership={current} />
        <span className="truncate font-medium">{current.club_name}</span>
        <span className="hidden shrink-0 text-xs text-zinc-500 xl:inline">· {current.role_name}</span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <div
          className="absolute left-0 z-40 mt-1 w-72 overflow-hidden rounded-md border border-[var(--club-line)] bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
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
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--club-primary-soft)] dark:hover:bg-zinc-800"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ClubMark membership={m} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {m.club_name}
                        </span>
                        <span className="truncate text-xs text-zinc-500">
                          {m.role_name}
                        </span>
                      </div>
                    </div>
                    {active && <Check className="h-4 w-4 text-[var(--club-primary)]" />}
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
