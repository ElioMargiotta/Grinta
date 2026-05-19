import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { requireMembership } from "@/lib/auth/getUser";
import {
  ClubPlayerForm,
  type EditablePlayer,
} from "@/components/contingent/ClubPlayerForm";
import { DeletePlayerSection } from "@/components/contingent/DeletePlayerSection";

export default async function ContingentPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireMembership(locale);
  const t = await getTranslations("contingent");

  const { data: player } = await supabase
    .from("players")
    .select(
      `id, first_name, last_name, birth_date, position, jersey_number, notes,
       strong_foot, license_number, js_number, email, phone, nationality,
       address, postal_code, city, canton,
       guardian_name, guardian_email, guardian_phone,
       guardian2_name, guardian2_email, guardian2_phone`,
    )
    .eq("id", playerId)
    .single<EditablePlayer>();

  if (!player) notFound();

  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/contingent"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {fullName}
        </h1>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t("editTitle")}
        </h2>
        <ClubPlayerForm player={player} />
      </Card>

      <DeletePlayerSection playerId={player.id} playerName={fullName} />
    </div>
  );
}
