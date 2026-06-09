import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClipboardList } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/Section";
import { requirePersona } from "@/lib/auth/getUser";
import {
  PendingInvitationsCard,
  type PendingInvitation,
} from "@/components/player/PendingInvitationsCard";
import { PlayerEvaluationReport } from "@/components/evaluation/PlayerEvaluationReport";
import {
  mergeEvaluation,
  type EvaluationData,
} from "@/components/evaluation/types";

type PlayerRow = {
  id: string;
  club_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  position: string | null;
  jersey_number: number | null;
  strong_foot: string | null;
  license_number: string | null;
  js_number: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  canton: string | null;
  photo_url: string | null;
  dual_licence_club: string | null;
  dual_licence_level: string | null;
  dual_licence_team: string | null;
};

type InvitationRow = {
  id: string;
  kind: "staff" | "player";
  expires_at: string;
  clubs: { name: string } | null;
  club_roles: { name: string } | null;
  teams: { name: string } | null;
};

type SharedEvaluationRow = {
  id: string;
  season: string | null;
  evaluation_date: string | null;
  data: Partial<EvaluationData> | null;
};

function Field({ label, value }: { label: string; value: string | number | null }) {
  const display = value === null || value === "" ? "—" : String(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-sm text-zinc-900 dark:text-zinc-100">{display}</div>
    </div>
  );
}

export default async function PlayerMePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requirePersona(locale, "player");
  const t = await getTranslations("playerMe");
  const tInv = await getTranslations("invitations");

  const [{ data: player }, { data: invitationRows }] = await Promise.all([
    supabase
      .from("players")
      .select(
        `id, club_id, first_name, last_name, birth_date, position, jersey_number,
         strong_foot, license_number, js_number, email, phone, nationality,
         address, postal_code, city, canton, photo_url,
         dual_licence_club, dual_licence_level, dual_licence_team`,
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<PlayerRow>(),
    supabase
      .from("club_invitations")
      .select(
        `id, kind, expires_at,
         clubs!inner(name),
         club_roles(name),
         teams(name)`,
      )
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .returns<InvitationRow[]>(),
  ]);

  const invitations: PendingInvitation[] = (invitationRows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    clubName: r.clubs?.name ?? "—",
    roleName: r.club_roles?.name ?? null,
    teamName: r.teams?.name ?? null,
    expiresAt: r.expires_at,
  }));

  if (!player) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>

        <Section>
          <div className="flex flex-col items-start gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {tInv("welcomeTitle")}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {invitations.length > 0
                ? tInv("welcomeWithInvites")
                : tInv("welcomeNoInvites")}
            </p>
          </div>
        </Section>

        <PendingInvitationsCard locale={locale} invitations={invitations} />
      </div>
    );
  }

  const { data: sharedEvalRows } = await supabase
    .from("player_evaluations")
    .select("id, season, evaluation_date, data")
    .eq("player_id", player.id)
    .eq("shared_with_player", true)
    .order("evaluation_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<SharedEvaluationRow[]>();

  const sharedEvaluations = (sharedEvalRows ?? []).map((row) => ({
    id: row.id,
    season: row.season,
    evaluationDate: row.evaluation_date,
    data: mergeEvaluation(row.data),
  }));

  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        {player.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photo_url}
            alt={fullName}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--club-primary)] text-base font-semibold text-[var(--club-primary-foreground)]">
            {player.first_name[0]}
            {player.last_name[0]}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {fullName}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("readOnlyHint")}</p>
        </div>
      </div>

      <PendingInvitationsCard locale={locale} invitations={invitations} />

      <Section>
        <SectionHeader title={t("sectionIdentity")} className="mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("firstName")} value={player.first_name} />
          <Field label={t("lastName")} value={player.last_name} />
          <Field label={t("birthDate")} value={player.birth_date} />
          <Field label={t("nationality")} value={player.nationality} />
        </div>
      </Section>

      <Section>
        <SectionHeader title={t("sectionGame")} className="mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("position")} value={player.position} />
          <Field label={t("jerseyNumber")} value={player.jersey_number} />
          <Field label={t("strongFoot")} value={player.strong_foot} />
          <Field label={t("licenseNumber")} value={player.license_number} />
          <Field label={t("jsNumber")} value={player.js_number} />
        </div>
      </Section>

      <Section>
        <SectionHeader title={t("sectionContact")} className="mb-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("email")} value={player.email} />
          <Field label={t("phone")} value={player.phone} />
          <Field label={t("address")} value={player.address} />
          <Field label={t("postalCode")} value={player.postal_code} />
          <Field label={t("city")} value={player.city} />
          <Field label={t("canton")} value={player.canton} />
        </div>
      </Section>

      {player.dual_licence_club && (
        <Section>
          <SectionHeader title={t("sectionDualLicence")} className="mb-4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("dualLicenceClub")} value={player.dual_licence_club} />
            <Field label={t("dualLicenceLevel")} value={player.dual_licence_level} />
            <Field label={t("dualLicenceTeam")} value={player.dual_licence_team} />
          </div>
        </Section>
      )}

      {sharedEvaluations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("sectionEvaluation")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("evaluationHint")}
          </p>
          {sharedEvaluations.map((ev) => (
            <Section key={ev.id}>
              <SectionHeader
                icon={ClipboardList}
                title={
                  ev.evaluationDate
                    ? new Date(ev.evaluationDate).toLocaleDateString(locale)
                    : t("evaluationNoDate")
                }
                description={ev.season ?? undefined}
                className="mb-5"
              />
              <PlayerEvaluationReport data={ev.data} />
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
