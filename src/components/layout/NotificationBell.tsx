"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  isNotificationForView,
  type NotificationRow,
  type NotificationView,
} from "@/lib/notifications/types";

type PresentedNotification = {
  icon: typeof Bell;
  title: string;
  body: string | null;
  href: string | null;
};

export function NotificationBell({
  userId,
  view,
  initialItems,
  initialUnread,
}: {
  userId: string;
  view: NotificationView;
  initialItems: NotificationRow[];
  initialUnread: number;
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<NotificationRow[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  // Onglet d'affichage : non lues par défaut, "toutes" pour l'historique.
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const containerRef = useRef<HTMLDivElement>(null);

  // Realtime : chaque INSERT pour ce compte pousse la notif en tête et
  // incrémente le badge. Le filtre user_id double la RLS (qui protège déjà).
  // On ignore les types hors de cette vue (ex. une convocation ne doit pas
  // apparaître côté entraîneur même si le compte est aussi staff).
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${view}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          if (!isNotificationForView(row.type, view)) return;
          setItems((prev) =>
            prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 30),
          );
          if (!row.read_at) setUnread((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, view]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const present = useCallback(
    (n: NotificationRow): PresentedNotification => {
      switch (n.type) {
        case "match_convocation": {
          const p = n.payload ?? {};
          const team = (p.team_name as string) ?? "";
          const opponent = (p.opponent as string | null) ?? null;
          const startsAt = p.starts_at ? new Date(p.starts_at as string) : null;
          const date = startsAt ? dateFmt.format(startsAt) : "";
          const body = opponent
            ? t("convocationBody", { opponent, date })
            : t("convocationBodyNoOpponent", { date });
          // Côté joueur, l'action (Confirmer/Décliner) vit dans l'agenda.
          // Côté staff, on renvoie vers la fiche match.
          const href =
            view === "player"
              ? "/schedule"
              : `/planner/${p.team_id as string}/match/${p.match_id as string}`;
          return {
            icon: CalendarCheck,
            title: t("convocationTitle", { team }),
            body,
            href,
          };
        }
        default:
          return { icon: Bell, title: n.type, body: null, href: null };
      }
    },
    [dateFmt, t, view],
  );

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((n) =>
          n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
      setUnread((n) => Math.max(0, n - 1));
      await supabase.rpc("mark_notification_read", { p_id: id });
    },
    [supabase],
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnread(0);
    await supabase.rpc("mark_all_notifications_read");
  }, [supabase]);

  // Retrait définitif : supprime SA row (RPC dismiss_notification, DEFINER).
  const dismiss = useCallback(
    async (n: NotificationRow) => {
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.read_at) setUnread((c) => Math.max(0, c - 1));
      await supabase.rpc("dismiss_notification", { p_id: n.id });
    },
    [supabase],
  );

  const handleSelect = useCallback(
    (n: NotificationRow) => {
      const { href } = present(n);
      if (!n.read_at) void markRead(n.id);
      setOpen(false);
      if (href) router.push(href);
    },
    [present, markRead, router],
  );

  // Onglet "non lues" : on masque les lues ; "toutes" : historique complet.
  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read_at) : items),
    [items, filter],
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("bellAria")}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            aria-label={t("unreadAria", { count: unread })}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--club-primary)] px-1 text-[10px] font-semibold text-[var(--club-primary-foreground)]"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-md border border-[var(--club-line)] bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-[var(--club-line)] px-3 py-2 dark:border-zinc-800">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {t("title")}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-[var(--club-primary)] hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="flex gap-1 border-b border-[var(--club-line)] px-2 py-1.5 dark:border-zinc-800">
            {(["unread", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-[var(--club-primary-soft)] text-[var(--club-primary)]"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {f === "unread" ? t("tabUnread", { count: unread }) : t("tabAll")}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              {filter === "unread" ? t("noUnread") : t("empty")}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {visibleItems.map((n) => {
                const pres = present(n);
                const Icon = pres.icon;
                const isRead = Boolean(n.read_at);
                return (
                  <li
                    key={n.id}
                    className="group relative flex items-stretch hover:bg-[var(--club-primary-soft)] dark:hover:bg-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(n)}
                      className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pr-8 pl-3 text-left"
                    >
                      <span className="relative mt-0.5 shrink-0">
                        <Icon
                          className={`h-4 w-4 ${
                            isRead ? "text-zinc-400" : "text-[var(--club-primary)]"
                          }`}
                        />
                        {!isRead && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--club-primary)]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            isRead
                              ? "font-normal text-zinc-500 dark:text-zinc-400"
                              : "font-medium text-zinc-900 dark:text-zinc-100"
                          }`}
                        >
                          {pres.title}
                        </span>
                        {pres.body && (
                          <span
                            className={`block truncate text-xs ${
                              isRead ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            {pres.body}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void dismiss(n)}
                      aria-label={t("dismissAria")}
                      className="absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
