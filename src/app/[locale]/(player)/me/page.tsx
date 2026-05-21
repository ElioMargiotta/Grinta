import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { requirePersona } from "@/lib/auth/getUser";

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

  const { data: player } = await supabase
    .from("players")
    .select(
      `id, club_id, first_name, last_name, birth_date, position, jersey_number,
       strong_foot, license_number, js_number, email, phone, nationality,
       address, postal_code, city, canton, photo_url,
       dual_licence_club, dual_licence_level, dual_licence_team`,
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<PlayerRow>();

  if (!player) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
        </Card>
      </div>
    );
  }

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

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("sectionIdentity")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("firstName")} value={player.first_name} />
          <Field label={t("lastName")} value={player.last_name} />
          <Field label={t("birthDate")} value={player.birth_date} />
          <Field label={t("nationality")} value={player.nationality} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("sectionGame")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("position")} value={player.position} />
          <Field label={t("jerseyNumber")} value={player.jersey_number} />
          <Field label={t("strongFoot")} value={player.strong_foot} />
          <Field label={t("licenseNumber")} value={player.license_number} />
          <Field label={t("jsNumber")} value={player.js_number} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("sectionContact")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("email")} value={player.email} />
          <Field label={t("phone")} value={player.phone} />
          <Field label={t("address")} value={player.address} />
          <Field label={t("postalCode")} value={player.postal_code} />
          <Field label={t("city")} value={player.city} />
          <Field label={t("canton")} value={player.canton} />
        </div>
      </Card>

      {player.dual_licence_club && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {t("sectionDualLicence")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label={t("dualLicenceClub")} value={player.dual_licence_club} />
            <Field label={t("dualLicenceLevel")} value={player.dual_licence_level} />
            <Field label={t("dualLicenceTeam")} value={player.dual_licence_team} />
          </div>
        </Card>
      )}
    </div>
  );
}
