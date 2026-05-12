"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AccessLevel } from "@/lib/club/types";
import {
  createRoleAction,
  deleteRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/app/[locale]/(app)/settings/club/actions";

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
  roles: Role[];
  teams: Team[];
  members: Member[];
  invitations: Invitation[];
};

const ACCESS_LABEL: Record<AccessLevel, string> = {
  full: "Total",
  extended: "Étendu",
  team: "Équipe assignée",
  team_readonly: "Lecture seule équipe",
};

const ACCESS_HELP: Record<AccessLevel, string> = {
  full: "Tout, y compris facturation et membres.",
  extended: "Toutes les équipes en écriture, pas la facturation.",
  team: "Une ou plusieurs équipes spécifiques.",
  team_readonly: "Lecture seule sur une ou plusieurs équipes.",
};

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";

export function ClubSettings({ data }: { data: Data }) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
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
      {/* INVITE */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Inviter un membre
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Sélectionne un rôle et envoie le lien généré.
        </p>

        <form
          className="mt-4 flex flex-col gap-4"
          action={(formData) => {
            setInviteError(null);
            setInviteUrl(null);
            startTransition(async () => {
              const result = await inviteMemberAction(formData);
              if ("error" in result) setInviteError(result.error);
              else setInviteUrl(result.url);
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">Email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="coach@example.com"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">Rôle</span>
              <select
                name="roleId"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className={inputClass}
              >
                {data.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {ACCESS_LABEL[r.access_level]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {needsTeams && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700">
                Équipes assignées
              </span>
              {data.teams.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Aucune équipe dans ce club. Crée une équipe d&apos;abord.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.teams.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs"
                    >
                      <input type="checkbox" name="teamIds" value={t.id} />
                      <span>{t.name}</span>
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

          {inviteUrl && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span className="truncate font-mono text-xs">{inviteUrl}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-900 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-800"
              >
                <Copy className="h-3 w-3" />
                Copier
              </button>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? "Création…" : "Générer le lien d'invitation"}
          </Button>
        </form>
      </section>

      {/* PENDING INVITATIONS */}
      {data.invitations.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Invitations en attente ({data.invitations.length})
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
                    {inv.club_roles?.name} · expire le{" "}
                    {new Date(inv.expires_at).toLocaleDateString("fr-CH")}
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
                    Révoquer
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
          Membres ({data.members.length})
        </h2>
        <ul className="mt-4 divide-y divide-zinc-100">
          {data.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-zinc-900">
                  {m.profiles?.full_name?.trim() || "(sans nom)"}
                </span>
                <span className="text-xs text-zinc-500">
                  {m.club_roles?.name} ·{" "}
                  {m.club_roles
                    ? ACCESS_LABEL[m.club_roles.access_level]
                    : "—"}
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
                  Retirer
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {/* ROLES */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Rôles du club</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Crée des libellés sur mesure (Président, Resp. formation, etc.). Le
          niveau d&apos;accès est figé par le système.
        </p>

        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          action={(formData) =>
            startTransition(async () => {
              await createRoleAction(formData);
            })
          }
        >
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Libellé</span>
            <input
              name="name"
              required
              maxLength={50}
              placeholder="Responsable formation"
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">Niveau d&apos;accès</span>
            <select name="accessLevel" defaultValue="extended" className={inputClass}>
              <option value="full">{ACCESS_LABEL.full} — {ACCESS_HELP.full}</option>
              <option value="extended">
                {ACCESS_LABEL.extended} — {ACCESS_HELP.extended}
              </option>
              <option value="team">
                {ACCESS_LABEL.team} — {ACCESS_HELP.team}
              </option>
              <option value="team_readonly">
                {ACCESS_LABEL.team_readonly} — {ACCESS_HELP.team_readonly}
              </option>
            </select>
          </label>
          <Button type="submit" disabled={isPending}>
            Ajouter le rôle
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
                  {ACCESS_LABEL[r.access_level]}
                  {r.is_system && " · système"}
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
