"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  Copy,
  ImageUp,
  MessageCircle,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AccountDirectoryInput } from "@/components/account/AccountDirectoryInput";
import type { AccessLevel } from "@/lib/club/types";
import {
  createRoleAction,
  deleteRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  updateClubIdentityAction,
  updateMemberAction,
} from "@/app/[locale]/(app)/settings/club/actions";
import type { ClubIdentity } from "@/lib/club/types";

type Role = {
  id: string;
  name: string;
  access_level: AccessLevel;
  is_system: boolean;
};

type Team = { id: string; name: string; season: string | null };

type Member = {
  id: string;
  user_id: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
  club_roles: { id: string; name: string; access_level: AccessLevel } | null;
  team_ids: string[];
};

type Invitation = {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  club_roles: { name: string; access_level: AccessLevel } | null;
};

type Data = {
  membership: { access_level: AccessLevel; club_id: string };
  clubIdentity: ClubIdentity & { name: string };
  roles: Role[];
  teams: Team[];
  members: Member[];
  invitations: Invitation[];
};

type Tab = "general" | "staff" | "roles";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15";

// Pastille colorée par niveau d'accès — reprend la sémantique du reste de l'app
// (rouge = plein accès, dégradé jusqu'au gris = lecture seule).
const ACCESS_BADGE: Record<AccessLevel, string> = {
  full: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  extended: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  team: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  team_readonly: "bg-muted text-muted-foreground",
};

function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "—";
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ClubSettings({ data }: { data: Data }) {
  const locale = useLocale();
  const t = useTranslations("settings.club");
  const accessLabel = (level: AccessLevel) => t(`access.${level}`);
  const accessHelp = (level: AccessLevel) => t(`access.${level}Help`);

  const [tab, setTab] = useState<Tab>("general");
  const [filterRoleId, setFilterRoleId] = useState<string>("");
  const [filterTeamId, setFilterTeamId] = useState<string>("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  // Logos du regroupement : liste ordonnée. Les existants portent une `url` ; les
  // nouveaux portent en plus un `file` (uploadé à l'enregistrement).
  const MAX_LOGOS = 6;
  const [logos, setLogos] = useState<{ id: string; url: string; file?: File }[]>(
    () => data.clubIdentity.logos.map((url, i) => ({ id: `existing-${i}`, url })),
  );
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState<boolean>(true);
  const [inviteDirect, setInviteDirect] = useState<boolean>(false);
  const [inviteLinkFallback, setInviteLinkFallback] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    data.roles[0]?.id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  const selectedRole = data.roles.find((r) => r.id === selectedRoleId);
  const needsTeams =
    selectedRole &&
    (selectedRole.access_level === "team" ||
      selectedRole.access_level === "team_readonly");

  // Un membre « plein accès » (full/extended) couvre toutes les équipes ; un
  // membre scopé (team/team_readonly) ne matche que ses équipes assignées.
  const memberMatchesTeam = (m: Member) => {
    if (!filterTeamId) return true;
    if (m.club_roles?.access_level === "full" || m.club_roles?.access_level === "extended") {
      return true;
    }
    return m.team_ids.includes(filterTeamId);
  };

  // Effectif groupé par rôle (coach, staff, …), filtré par rôle et par équipe.
  const groups = data.roles
    .filter((role) => !filterRoleId || role.id === filterRoleId)
    .map((role) => ({
      role,
      members: data.members.filter(
        (m) => m.club_roles?.id === role.id && memberMatchesTeam(m),
      ),
    }));
  const filteredMemberCount = groups.reduce((sum, g) => sum + g.members.length, 0);

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "general", label: t("tabs.general"), icon: Shield },
    { key: "staff", label: t("tabs.staff"), icon: Users },
    { key: "roles", label: t("tabs.roles"), icon: Shield },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Sous-onglets façon sélecteur de tour du wizard (soulignés) */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(({ key, label }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 pb-2.5 text-[13px] font-semibold transition ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* =================== GÉNÉRAL =================== */}
      {tab === "general" && (
        <form
          className="flex flex-col gap-10"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.delete("logoFile");
            fd.set(
              "existingLogos",
              JSON.stringify(logos.filter((l) => !l.file).map((l) => l.url)),
            );
            for (const item of logos) {
              if (item.file) fd.append("logoFile", item.file);
            }
            startTransition(async () => {
              await updateClubIdentityAction(fd);
            });
          }}
        >
          {/* Logos du regroupement + nom */}
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {logos.length > 0 ? (
                  logos.map((logo) => (
                    <div key={logo.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.url}
                        alt=""
                        className="h-20 w-20 rounded-2xl object-contain ring-1 ring-border"
                      />
                      <button
                        type="button"
                        aria-label={t("identity.removeLogo")}
                        onClick={() =>
                          setLogos((prev) => prev.filter((l) => l.id !== logo.id))
                        }
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                    {initials(data.clubIdentity.name)}
                  </div>
                )}

                {logos.length < MAX_LOGOS && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logos.length === 0 ? (
                      <ImageUp className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {logos.length === 0
                      ? t("identity.uploadLogo")
                      : t("identity.addLogo")}
                  </Button>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{t("identity.logoHint")}</span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) {
                    setLogos((prev) => {
                      const room = Math.max(0, MAX_LOGOS - prev.length);
                      const next = files.slice(0, room).map((file, i) => ({
                        id: `new-${Date.now()}-${i}`,
                        url: URL.createObjectURL(file),
                        file,
                      }));
                      return [...prev, ...next];
                    });
                  }
                  e.target.value = "";
                }}
              />
            </div>

            <label className="flex max-w-md flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">
                {t("identity.clubName")}
              </span>
              <input
                name="clubName"
                required
                minLength={2}
                maxLength={80}
                defaultValue={data.clubIdentity.name}
                className={inputClass}
              />
            </label>
          </section>

          {/* Couleurs */}
          <section className="flex flex-col gap-5 border-t border-border pt-8">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-foreground">
                {t("identity.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("identity.description")}
              </p>
            </div>

            <div className="max-w-sm">
              <ColorField
                label={t("identity.clubColor")}
                name="primaryColor"
                defaultValue={data.clubIdentity.theme_primary_color}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={isPending}>
                {t("identity.saveIdentity")}
              </Button>
            </div>
          </section>
        </form>
      )}

      {/* =================== EFFECTIF =================== */}
      {tab === "staff" && (
        <div className="flex flex-col gap-8">
          {/* MEMBERS grouped by role, avec filtres rôle / équipe */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {t("members.title", { n: data.members.length })}
              </h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {t("members.filterRole")}
                  </span>
                  <select
                    value={filterRoleId}
                    onChange={(e) => setFilterRoleId(e.target.value)}
                    className={`${inputClass} h-9 w-44`}
                  >
                    <option value="">{t("members.filterAllRoles")}</option>
                    {data.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {t("members.filterTeam")}
                  </span>
                  <select
                    value={filterTeamId}
                    onChange={(e) => setFilterTeamId(e.target.value)}
                    className={`${inputClass} h-9 w-44`}
                  >
                    <option value="">{t("members.filterAllTeams")}</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {(filterRoleId || filterTeamId) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("members.filteredCount", { n: filteredMemberCount })}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-6">
              {groups.map(({ role, members }) => (
                <div key={role.id}>
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <span className="text-sm font-semibold text-foreground">
                      {role.name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ACCESS_BADGE[role.access_level]}`}
                    >
                      {accessLabel(role.access_level)}
                    </span>
                    <span className="text-xs text-muted-foreground">{members.length}</span>
                  </div>
                  {members.length === 0 ? (
                    <p className="border-y border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                      {t("members.emptyRole")}
                    </p>
                  ) : (
                    <div className="overflow-hidden border-y border-border bg-card/[0.72]">
                      {members.map((m) => {
                        const teamScoped =
                          role.access_level === "team" ||
                          role.access_level === "team_readonly";
                        const teamNames = m.team_ids
                          .map((id) => data.teams.find((t) => t.id === id)?.name)
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <div
                            key={m.id}
                            className="border-b border-border px-4 py-3 last:border-b-0"
                          >
                            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                                  {initials(m.profiles?.full_name ?? null)}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-foreground">
                                    {m.profiles?.full_name?.trim() || t("members.unnamed")}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {role.name}
                                    {teamScoped && teamNames && (
                                      <span className="text-muted-foreground"> · {teamNames}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 md:justify-self-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingMemberId(
                                      editingMemberId === m.id ? null : m.id,
                                    )
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                  {t("members.edit")}
                                </Button>
                                <form
                                  action={(formData) =>
                                    startTransition(async () => {
                                      await removeMemberAction(formData);
                                    })
                                  }
                                >
                                  <input type="hidden" name="userId" value={m.user_id} />
                                  <Button type="submit" variant="ghost" size="sm">
                                    <UserMinus className="h-4 w-4" />
                                    {t("members.remove")}
                                  </Button>
                                </form>
                              </div>
                            </div>
                            {editingMemberId === m.id && (
                              <MemberEditor
                                member={m}
                                roles={data.roles}
                                teams={data.teams}
                                onDone={() => setEditingMemberId(null)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =================== RÔLES & INVITATIONS =================== */}
      {tab === "roles" && (
        <div className="flex flex-col gap-8">
        {/* INVITE */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t("invite.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("invite.description")}</p>

          <form
            className="mt-4 flex flex-col gap-4"
            action={(formData) => {
              setInviteError(null);
              setInvitedEmail(null);
              setInviteDirect(false);
              setInviteLinkFallback(null);
              setInviteCopied(false);
              formData.set("locale", locale);
              const email = String(formData.get("identifier") ?? "");
              startTransition(async () => {
                const result = await inviteMemberAction(formData);
                if ("error" in result) {
                  setInviteError(result.error);
                } else {
                  setInvitedEmail(result.targetLabel ?? email);
                  setInviteEmailSent(result.emailSent);
                  setInviteDirect(result.direct);
                  setInviteLinkFallback(result.url);
                }
              });
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <AccountDirectoryInput
                name="identifier"
                label={t("invite.identifier")}
                required
                placeholder={t("invite.identifierPlaceholder")}
                hint={t("invite.identifierHint")}
                inputClassName={inputClass}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">{t("invite.role")}</span>
                <select
                  name="roleId"
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className={inputClass}
                >
                  {data.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {accessLabel(r.access_level)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {needsTeams && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">
                  {t("invite.assignedTeams")}
                </span>
                {data.teams.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    {t("invite.noTeamsInClub")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.teams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                      >
                        <input type="checkbox" name="teamIds" value={team.id} />
                        <span>{team.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {inviteError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {inviteError}
              </div>
            )}

            {invitedEmail && (
              <div
                className={
                  inviteDirect || inviteEmailSent
                    ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                    : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                }
              >
                {inviteDirect
                  ? t.rich("invite.directSaved", {
                      target: invitedEmail,
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })
                  : t.rich(inviteEmailSent ? "invite.emailSent" : "invite.emailFailed", {
                  email: invitedEmail,
                  strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                {!inviteDirect && inviteLinkFallback && (
                  <div className="mt-3 rounded-md border border-border bg-card p-3 text-xs text-foreground">
                    <div className="mb-1 font-medium">
                      {t("invite.linkReady")}
                    </div>
                    <div className="break-all font-mono text-[11px]">
                      {inviteLinkFallback}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${t("invite.whatsappMessage")} ${inviteLinkFallback}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {t("invite.shareLink")}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteLinkFallback);
                          setInviteCopied(true);
                          window.setTimeout(() => setInviteCopied(false), 1500);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {inviteCopied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {inviteCopied ? t("invite.copied") : t("invite.copyLink")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              loading={isPending}
              loadingLabel={t("invite.sending")}
              className="self-start"
            >
              {t("invite.send")}
            </Button>
          </form>
        </section>

        {/* PENDING INVITATIONS */}
        {data.invitations.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("pendingInvitations.title", { n: data.invitations.length })}
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {data.invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {inv.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inv.club_roles?.name} ·{" "}
                      {t("pendingInvitations.expiresOn", {
                        date: new Date(inv.expires_at).toLocaleDateString(locale),
                      })}
                    </span>
                  </div>
                  <form
                    action={(formData) =>
                      startTransition(async () => {
                        await revokeInvitationAction(formData);
                      })
                    }
                  >
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                      {t("pendingInvitations.revoke")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ROLES */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            {t("roles.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("roles.description")}</p>

          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            action={(formData) =>
              startTransition(async () => {
                await createRoleAction(formData);
              })
            }
          >
            <label className="flex min-w-[200px] flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{t("roles.label")}</span>
              <input
                name="name"
                required
                maxLength={50}
                placeholder={t("roles.labelPlaceholder")}
                className={inputClass}
              />
            </label>
            <label className="flex min-w-[200px] flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">
                {t("roles.accessLevel")}
              </span>
              <select
                name="accessLevel"
                defaultValue="extended"
                className={inputClass}
              >
                <option value="full">
                  {accessLabel("full")} — {accessHelp("full")}
                </option>
                <option value="extended">
                  {accessLabel("extended")} — {accessHelp("extended")}
                </option>
                <option value="team">
                  {accessLabel("team")} — {accessHelp("team")}
                </option>
                <option value="team_readonly">
                  {accessLabel("team_readonly")} — {accessHelp("team_readonly")}
                </option>
              </select>
            </label>
            <Button type="submit" loading={isPending}>
              {t("roles.addRole")}
            </Button>
          </form>

          <ul className="mt-6 divide-y divide-border">
            {data.roles.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ACCESS_BADGE[r.access_level]}`}
                  >
                    {accessLabel(r.access_level)}
                  </span>
                  {r.is_system && (
                    <span className="text-xs text-muted-foreground">
                      {t("roles.system")}
                    </span>
                  )}
                </div>
                {!r.is_system && (
                  <form
                    action={(formData) =>
                      startTransition(async () => {
                        await deleteRoleAction(formData);
                      })
                    }
                  >
                    <input type="hidden" name="roleId" value={r.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
        </div>
      )}
    </div>
  );
}

// Inline editor for an existing member: change role and (for team-scoped roles)
// the set of assigned teams. Submits to updateMemberAction.
function MemberEditor({
  member,
  roles,
  teams,
  onDone,
}: {
  member: Member;
  roles: Role[];
  teams: Team[];
  onDone: () => void;
}) {
  const t = useTranslations("settings.club");
  const [isPending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState(member.club_roles?.id ?? roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const role = roles.find((r) => r.id === roleId);
  const needsTeams =
    role?.access_level === "team" || role?.access_level === "team_readonly";

  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3"
      action={(formData) => {
        setError(null);
        formData.set("membershipId", member.id);
        startTransition(async () => {
          const res = await updateMemberAction(formData);
          if (res && "error" in res) setError(res.error);
          else onDone();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">{t("members.editRole")}</span>
        <select
          name="roleId"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className={inputClass}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {t(`access.${r.access_level}`)}
            </option>
          ))}
        </select>
      </label>

      {needsTeams && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">{t("members.editTeams")}</span>
          {teams.length === 0 ? (
            <p className="text-xs text-amber-700">{t("invite.noTeamsInClub")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    name="teamIds"
                    value={team.id}
                    defaultChecked={member.team_ids.includes(team.id)}
                  />
                  <span>{team.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          loading={isPending}
          loadingLabel={t("members.saving")}
        >
          {t("members.save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("members.cancel")}
        </Button>
      </div>
    </form>
  );
}

function ColorField({
  label,
  name,
  defaultValue,
  inverse = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  inverse?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span
        className={
          inverse ? "font-medium text-background" : "font-medium text-foreground"
        }
      >
        {label}
      </span>
      <span className="flex h-10 overflow-hidden rounded-lg border border-border bg-card">
        <input
          type="color"
          name={name}
          defaultValue={defaultValue}
          className="h-10 w-12 shrink-0 cursor-pointer border-0 bg-transparent p-1"
        />
        <span className="flex flex-1 items-center px-3 font-mono text-xs text-muted-foreground">
          {defaultValue}
        </span>
      </span>
    </label>
  );
}
