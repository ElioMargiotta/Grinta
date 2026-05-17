import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationForm } from "@/components/onboarding/AcceptInvitationForm";

type Preview = {
  club_id: string;
  club_name: string;
  role_name: string;
  access_level: "full" | "extended" | "team" | "team_readonly";
  email: string;
  expires_at: string;
  already_accepted: boolean;
  expired: boolean;
};

const ACCESS_LABEL: Record<Preview["access_level"], string> = {
  full: "Accès total",
  extended: "Accès étendu (toutes les équipes)",
  team: "Accès à l'équipe assignée",
  team_readonly: "Lecture seule sur l'équipe assignée",
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("preview_invitation", {
    p_token: token,
  });

  const preview = (rows as Preview[] | null)?.[0];

  if (error || !preview) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">
          Invitation introuvable
        </h1>
        <p className="text-sm text-amber-800">
          Le lien est invalide ou a déjà été révoqué.
        </p>
      </div>
    );
  }

  if (preview.expired) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-base font-semibold text-amber-900">
          Invitation expirée
        </h1>
        <p className="text-sm text-amber-800">
          Demande à la personne qui t&apos;a invité de t&apos;en renvoyer une
          nouvelle.
        </p>
      </div>
    );
  }

  if (preview.already_accepted) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5">
        <h1 className="text-base font-semibold text-emerald-900">
          Invitation déjà acceptée
        </h1>
        <p className="text-sm text-emerald-800">
          Connecte-toi pour accéder à <strong>{preview.club_name}</strong>.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-emerald-900 underline"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            Tu as été invité à rejoindre {preview.club_name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Rôle : <strong>{preview.role_name}</strong> ·{" "}
            {ACCESS_LABEL[preview.access_level as Preview["access_level"]]}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Invitation envoyée à <strong>{preview.email}</strong>.
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-700">
            Connecte-toi (ou crée un compte avec cet email) pour accepter.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Se connecter
            </Link>
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (user.email?.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-5">
        <h1 className="text-base font-semibold text-red-900">
          Mauvais compte
        </h1>
        <p className="text-sm text-red-800">
          Cette invitation a été envoyée à <strong>{preview.email}</strong>,
          mais tu es connecté en tant que <strong>{user.email}</strong>.
        </p>
        <p className="text-sm text-red-800">
          Déconnecte-toi et reconnecte-toi avec le bon compte.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          Rejoindre {preview.club_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Rôle : <strong>{preview.role_name}</strong> ·{" "}
          {ACCESS_LABEL[preview.access_level as Preview["access_level"]]}
        </p>
      </div>
      <AcceptInvitationForm token={token} />
    </div>
  );
}
