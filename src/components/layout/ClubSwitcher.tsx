"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Building2, UsersRound } from "lucide-react";
import { switchClubAction } from "@/app/[locale]/(app)/club-actions";
import { useLoading } from "@/components/ui/LoadingProvider";
import { ClubLogos } from "@/components/club/ClubLogos";
import type { ClubMembership } from "@/lib/club/types";

function ClubMark({ membership }: { membership: ClubMembership }) {
  return (
    <ClubLogos
      logos={membership.logos}
      alt={membership.club_name}
      imgClassName="h-6 w-6 rounded-sm"
      max={3}
      fallback={
        membership.is_group ? (
          <UsersRound className="h-4 w-4 shrink-0 text-[var(--club-primary)]" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-[var(--club-primary)]" />
        )
      }
    />
  );
}

function KindBadge({ isGroup }: { isGroup: boolean }) {
  return (
    <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {isGroup ? "Regroupement" : "Club"}
    </span>
  );
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
  const clubs = memberships.filter((m) => !m.is_group);
  const groups = memberships.filter((m) => m.is_group);

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
      <div className="flex max-w-52 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground lg:max-w-64 lg:gap-2 lg:px-3 lg:text-sm">
        <ClubMark membership={current} />
        <span className="truncate font-medium">{current.club_name}</span>
        <KindBadge isGroup={current.is_group} />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-52 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground hover:bg-accent lg:max-w-64 lg:gap-2 lg:px-3 lg:text-sm"
      >
        <ClubMark membership={current} />
        <span className="truncate font-medium">{current.club_name}</span>
        <KindBadge isGroup={current.is_group} />
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute left-0 z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <ul className="max-h-80 overflow-y-auto py-1">
            {[
              { title: "Clubs", items: clubs },
              { title: "Regroupements", items: groups },
            ].map((section) =>
              section.items.length > 0 ? (
                <li key={section.title} className="py-1">
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </div>
                  <ul>
                    {section.items.map((m) => {
                      const active = m.club_id === current.club_id;
                      return (
                        <li key={m.club_id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(m.club_id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <ClubMark membership={m} />
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium text-foreground">
                                  {m.club_name}
                                </span>
                                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                                  <KindBadge isGroup={m.is_group} />
                                </span>
                              </div>
                            </div>
                            {active && <Check className="h-4 w-4 text-[var(--club-primary)]" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
