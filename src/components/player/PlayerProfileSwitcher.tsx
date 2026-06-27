"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCircle, Users, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { setActivePlayerAction } from "@/app/[locale]/(player)/profile-actions";

export type SwitcherProfile = {
  playerId: string;
  clubName: string;
  name: string;
  relation: "self" | "guardian";
  status: "active" | "inactive" | "left" | "archived";
};

// Sélecteur de profil du portail (Lot E) : bascule entre fiches liées au compte
// — double passeport (mêmes nom, clubs différents) et fratrie (parent → enfants).
export function PlayerProfileSwitcher({
  profiles,
  activeId,
}: {
  profiles: SwitcherProfile[];
  activeId: string;
}) {
  const t = useTranslations("playerPortal");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (profiles.length < 2) return null;
  const active = profiles.find((p) => p.playerId === activeId) ?? profiles[0];

  function select(playerId: string) {
    setOpen(false);
    if (playerId === activeId) return;
    const fd = new FormData();
    fd.set("playerId", playerId);
    startTransition(async () => {
      await setActivePlayerAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--club-line)] bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {active.relation === "guardian" ? (
          <Users className="h-4 w-4 text-zinc-500" />
        ) : (
          <UserCircle className="h-4 w-4 text-zinc-500" />
        )}
        <span className="max-w-[40vw] truncate">
          {active.name} · {active.clubName}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 z-40 mt-1 w-72 overflow-hidden rounded-md border border-[var(--club-line)] bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            {profiles.map((p) => {
              const isActive = p.playerId === activeId;
              const Icon = p.relation === "guardian" ? Users : UserCircle;
              return (
                <li key={p.playerId}>
                  <button
                    type="button"
                    onClick={() => select(p.playerId)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--club-primary-soft)] dark:hover:bg-zinc-800"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-zinc-900 dark:text-zinc-100">
                        {p.name}
                        {p.relation === "guardian" && (
                          <span className="ml-1 text-xs text-zinc-400">
                            {t("childTag")}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {p.clubName}
                        {p.status !== "active" && ` · ${t(`status.${p.status}`)}`}
                      </span>
                    </span>
                    {isActive && <Check className="h-4 w-4 text-[var(--club-primary)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
