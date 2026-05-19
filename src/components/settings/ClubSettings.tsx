"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AccessLevel } from "@/lib/club/types";
import {
  createRoleAction,
  deleteRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  updateClubIdentityAction,
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

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export function ClubSettings({ data }: { data: Data }) {
  const locale = useLocale();
  const t = useTranslations("settings.club");
  const accessLabel = (level: AccessLevel) => t(`access.${level}`);
  const accessHelp = (level: AccessLevel) => t(`access.${level}Help`);

  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-10">
      {/* IDENTITY */}
      <section className="border-y border-[var(--club-line)] bg-white/70 px-0 py-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold text-zinc-900">
              {t("identity.title")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {t("identity.description")}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--club-line)] bg-white px-3 py-2">
            {data.clubIdentity.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.clubIdentity.logo_url}
                alt={data.clubIdentity.name}
                className="h-10 w-10 rounded-md object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-[var(--club-primary)]" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900">
                {data.clubIdentity.name}
              </div>
              <div className="text-xs text-zinc-500">
                {t("identity.workspacePreview")}
              </div>
            </div>
          </div>
        </div>

        <form
          className="mt-5 grid gap-4"
          action={(formData) =>
            startTransition(async () => {
              await updateClubIdentityAction(formData);
            })
          }
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">
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

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">
              {t("identity.logoUrl")}
            </span>
            <input
              name="logoUrl"
              type="url"
              inputMode="url"
              placeholder={t("identity.logoUrlPlaceholder")}
              defaultValue={data.clubIdentity.logo_url ?? ""}
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">
                {t("identity.dayMode")}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ColorField
                  label={t("identity.primaryColor")}
                  name="primaryColor"
                  defaultValue={data.clubIdentity.theme_primary_color}
                />
                <ColorField
                  label={t("identity.secondaryColor")}
                  name="secondaryColor"
                  defaultValue={data.clubIdentity.theme_secondary_color}
                />
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4">
              <div className="text-sm font-semibold text-white">
                {t("identity.nightMode")}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ColorField
                  label={t("identity.primaryColor")}
                  name="nightPrimaryColor"
                  defaultValue={data.clubIdentity.theme_night_primary_color}
                  inverse
                />
                <ColorField
                  label={t("identity.secondaryColor")}
                  name="nightSecondaryColor"
                  defaultValue={data.clubIdentity.theme_night_secondary_color}
                  inverse
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
              {(["day", "night"] as const).map((mode) => (
                <label
                  key={mode}
                  className="has-[:checked]:bg-[var(--club-primary)] has-[:checked]:text-[var(--club-primary-foreground)] rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600"
                >
                  <input
                    type="radio"
                    name="themeMode"
                    value={mode}
                    defaultChecked={data.clubIdentity.theme_mode === mode}
                    className="sr-only"
                  />
                  {mode === "day" ? t("identity.dayMode") : t("identity.nightMode")}
                </label>
              ))}
            </fieldset>
            <Button type="submit" loading={isPending}>
              {t("identity.saveIdentity")}
            </Button>
          </div>
        </form>
      </section>

      {/* INVITE */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          {t("invite.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("invite.description")}</p>

        <form
          className="mt-4 flex flex-col gap-4"
          action={(formData) => {
            setInviteError(null);
            setInvitedEmail(null);
            const email = String(formData.get("email") ?? "");
            startTransition(async () => {
              const result = await inviteMemberAction(formData);
              if ("error" in result) setInviteError(result.error);
              else setInvitedEmail(email);
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">{t("invite.email")}</span>
              <input
                type="email"
                name="email"
                required
                placeholder={t("invite.emailPlaceholder")}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">{t("invite.role")}</span>
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
              <span className="font-medium text-zinc-700">
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
                      className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs"
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
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {inviteError}
            </div>
          )}

          {invitedEmail && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {t.rich("invite.savedFor", {
                email: invitedEmail,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
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
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            {t("pendingInvitations.title", { n: data.invitations.length })}
          </h2>
          <ul className="mt-4 divide-y divide-zinc-100">
            {data.invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-zinc-900">
                    {inv.email}
                  </span>
                  <span className="text-xs text-zinc-500">
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

      {/* MEMBERS */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          {t("members.title", { n: data.members.length })}
        </h2>
        <ul className="mt-4 divide-y divide-zinc-100">
          {data.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-zinc-900">
                  {m.profiles?.full_name?.trim() || t("members.unnamed")}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.club_roles?.name} ·{" "}
                  {m.club_roles ? accessLabel(m.club_roles.access_level) : "—"}
                </span>
              </div>
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
            </li>
          ))}
        </ul>
      </section>

      {/* ROLES */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          {t("roles.title")}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{t("roles.description")}</p>

        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          action={(formData) =>
            startTransition(async () => {
              await createRoleAction(formData);
            })
          }
        >
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">{t("roles.label")}</span>
            <input
              name="name"
              required
              maxLength={50}
              placeholder={t("roles.labelPlaceholder")}
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">
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

        <ul className="mt-6 divide-y divide-zinc-100">
          {data.roles.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-zinc-900">{r.name}</span>
                <span className="text-xs text-zinc-500">
                  {accessLabel(r.access_level)}
                  {r.is_system && ` · ${t("roles.system")}`}
                </span>
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
          inverse ? "font-medium text-zinc-200" : "font-medium text-zinc-700"
        }
      >
        {label}
      </span>
      <span className="flex h-10 overflow-hidden rounded-md border border-zinc-300 bg-white">
        <input
          type="color"
          name={name}
          defaultValue={defaultValue}
          className="h-10 w-12 shrink-0 cursor-pointer border-0 bg-transparent p-1"
        />
        <span className="flex flex-1 items-center px-3 font-mono text-xs text-zinc-500">
          {defaultValue}
        </span>
      </span>
    </label>
  );
}
