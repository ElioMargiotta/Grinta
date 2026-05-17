import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { setRequestLocale } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { NavBar } from "@/components/landing/NavBar";
import { Reveal } from "@/components/landing/Reveal";
import {
  GrintaLogoIcon,
  GrintaLogoType,
  GrintaLogoTagline,
} from "@/components/landing/BrandSeal";
import { FlowSection } from "@/components/landing/FlowSection";
import { ManifestoLine } from "@/components/landing/ManifestoLine";

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect({ href: "/dashboard", locale });
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <NavBar loginLabel="Se connecter" ctaLabel="Démarrer ma saison" />

      <main>
        <Hero />
        <Manifesto />
        <FlowSection />
        <PricingSection />
        <FinalCTA />
      </main>

      <FooterBar />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-x-0 -top-40 h-[120%] pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 78% 30%, color-mix(in oklch, var(--accent) 22%, transparent) 0%, transparent 65%)," +
            "radial-gradient(50% 40% at 12% 60%, color-mix(in oklch, var(--accent) 10%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="absolute inset-0 grinta-grid pointer-events-none opacity-40" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-16 pb-24 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-end">
          <div className="lg:col-span-6">
            <Reveal>
              <div className="eyebrow-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full dot-accent" />
                Pour les entraîneurs et les clubs de football
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="h-display mt-5 text-5xl sm:text-6xl lg:text-7xl font-semibold">
                Un club.
                <br />
                Une{" "}
                <span className="text-accent-ink italic">identité</span>.
                <br />
                Une méthode.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p
                className="mt-6 max-w-xl text-[16px] leading-relaxed"
                style={{ color: "var(--ink-2)", textWrap: "pretty" }}
              >
                Grinta donne aux entraîneurs un outil unique pour planifier la
                saison, construire les microcycles et préparer les entraînements
                — de la pré-formation à l&apos;équipe première, sous une seule
                méthode de jeu.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#flow"
                  className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-lg btn-accent"
                >
                  Comment ça marche
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#tarifs"
                  className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-3 rounded-lg border"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  Voir les tarifs
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <dl className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Catégories
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    U7 → Pro
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Microcycles
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    +1 / -3
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-[11px] font-mono uppercase tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Méthode
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight">
                    1 club
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>
          <div className="lg:col-span-6">
            <Reveal delay={200}>
              <div className="relative mx-auto flex w-full max-w-[520px] flex-col items-center gap-6">
                <GrintaLogoIcon
                  size={420}
                  title="Grinta"
                  className="h-auto w-full max-w-[420px]"
                />
                <div className="flex flex-col items-center gap-3">
                  <GrintaLogoType
                    height={56}
                    title="GRINTA"
                    className="h-auto w-auto max-w-[320px]"
                  />
                  <GrintaLogoTagline
                    height={18}
                    title="One club. One identity. One method."
                    className="h-auto w-auto max-w-[320px] opacity-80"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, var(--bg))" }}
      />
    </section>
  );
}

// ── Manifesto ─────────────────────────────────────────────────────────────
function Manifesto() {
  const pillars = [
    {
      kicker: "01",
      title: "Un club",
      body: "De la pré-formation à l'équipe première, toutes les catégories partagent un seul espace de travail.",
    },
    {
      kicker: "02",
      title: "Une identité",
      body: "Pose les principes de jeu du club. Chaque entraîneur les retrouve dans ses microcycles et ses séances.",
    },
    {
      kicker: "03",
      title: "Une méthode",
      body: "Macro, méso, microcycles, séances : un seul fil conducteur. Tu planifies la saison une fois, puis tu la déclines.",
    },
  ];
  return (
    <section id="methode" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div className="max-w-3xl">
            <div className="eyebrow-mono">Le manifeste</div>
            <h2
              className="h-display mt-4 text-4xl sm:text-5xl font-semibold tracking-tight"
              style={{ textWrap: "balance" }}
            >
              Trois mots, gravés dans chaque écran.
            </h2>
            <p
              className="mt-5 text-[15px] leading-relaxed"
              style={{ color: "var(--ink-2)", textWrap: "pretty" }}
            >
              Grinta n&apos;est pas un agenda partagé. C&apos;est l&apos;outil
              qui force l&apos;alignement entre la philosophie du club, la
              planification de la saison et la séance de mardi soir.
            </p>
          </div>
        </Reveal>
        <div className="mt-16 hidden md:block">
          <ManifestoLine />
          <div className="mt-8 grid md:grid-cols-3 gap-12">
            {pillars.map((p, i) => (
              <Reveal key={p.kicker} delay={i * 120}>
                <div className="flex flex-col gap-3 text-center">
                  <span
                    className="font-mono text-[11px] tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {p.kicker}
                  </span>
                  <h3
                    className="text-3xl font-semibold tracking-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed mx-auto max-w-xs"
                    style={{ color: "var(--ink-2)", textWrap: "pretty" }}
                  >
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Mobile: simple stacked pillars without horizontal line */}
        <div className="md:hidden mt-12 flex flex-col gap-10">
          {pillars.map((p, i) => (
            <Reveal key={p.kicker} delay={i * 80}>
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="mt-2 w-2.5 h-2.5 rounded-full dot-accent shrink-0"
                />
                <div className="flex flex-col gap-2">
                  <span
                    className="font-mono text-[11px] tracking-widest"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {p.kicker}
                  </span>
                  <h3
                    className="text-2xl font-semibold tracking-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.title}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed"
                    style={{ color: "var(--ink-2)", textWrap: "pretty" }}
                  >
                    {p.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────
function PricingSection() {
  const tiers = [
    {
      name: "Coach",
      price: "Gratuit",
      sub: "Pour un entraîneur, une équipe.",
      features: [
        "1 équipe",
        "Bibliothèque illimitée",
        "Planificateur saison",
        "Export PDF",
      ],
      cta: "Créer mon compte",
      featured: false,
    },
    {
      name: "Club",
      price: "12 €",
      priceSuffix: "/ équipe / mois",
      sub: "Toutes les catégories, une seule méthode.",
      features: [
        "Équipes illimitées",
        "Vision globale du club",
        "Principes de jeu partagés",
        "Rôles staff & DTN",
        "Support prioritaire",
      ],
      cta: "Démarrer la saison",
      featured: true,
    },
    {
      name: "Centre de formation",
      price: "Sur devis",
      sub: "Pour les structures pro et académies.",
      features: [
        "Tout du plan Club",
        "SSO & onboarding staff",
        "Données de match",
        "Accompagnement méthodologique",
      ],
      cta: "Nous contacter",
      featured: false,
    },
  ] as const;

  return (
    <section id="tarifs" className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div className="max-w-2xl">
            <div className="eyebrow-mono">Tarifs</div>
            <h2 className="h-display mt-4 text-4xl sm:text-5xl font-semibold">
              Gratuit pour un coach. Juste pour un club.
            </h2>
          </div>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 80}>
              <div
                className={
                  "h-full rounded-2xl border p-7 flex flex-col gap-5 transition-transform hover:-translate-y-1 " +
                  (tier.featured ? "border-accent" : "")
                }
                style={{
                  borderColor: tier.featured ? undefined : "var(--line)",
                  background: tier.featured ? "var(--paper)" : "transparent",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">{tier.name}</span>
                  {tier.featured && (
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink">
                      recommandé
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">
                    {tier.price}
                  </span>
                  {"priceSuffix" in tier && tier.priceSuffix && (
                    <span
                      className="text-[12px] font-mono"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {tier.priceSuffix}
                    </span>
                  )}
                </div>
                <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  {tier.sub}
                </p>
                <ul
                  className="flex flex-col gap-2 text-[13px]"
                  style={{ color: "var(--ink-2)" }}
                >
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--accent-ink)" }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={
                    "mt-auto inline-flex justify-center items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-lg " +
                    (tier.featured ? "btn-accent" : "btn-ink")
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section id="cta" className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal>
          <div
            className="rounded-3xl px-8 py-14 sm:px-14 sm:py-20 relative overflow-hidden"
            style={{ background: "var(--ink)", color: "#fafaf7" }}
          >
            <div className="absolute inset-0 pitch-stripes opacity-[0.18] pointer-events-none" />
            <div
              className="absolute -inset-40 pointer-events-none"
              style={{
                background:
                  "radial-gradient(40% 40% at 80% 30%, color-mix(in oklch, var(--accent) 50%, transparent) 0%, transparent 60%)",
              }}
            />
            <div className="relative grid lg:grid-cols-12 gap-10 items-end">
              <div className="lg:col-span-8">
                <div
                  className="eyebrow-mono"
                  style={{ color: "rgba(250,250,247,.55)" }}
                >
                  Prêt à structurer ta saison ?
                </div>
                <h2
                  className="h-display mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold"
                  style={{ textWrap: "balance" }}
                >
                  Donne au club une seule voix.
                  <br />
                  <span
                    className="italic"
                    style={{ color: "var(--accent)" }}
                  >
                    Pose-la
                  </span>{" "}
                  avec Grinta.
                </h2>
                <p
                  className="mt-6 max-w-xl text-[15px] leading-relaxed"
                  style={{
                    color: "rgba(250,250,247,.7)",
                    textWrap: "pretty",
                  }}
                >
                  Création de compte en 30 secondes. Pas de carte bancaire. Tu
                  peux importer la saison en cours et reprendre là où tu
                  t&apos;es arrêté.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-3 lg:items-end">
                <Link
                  href="/signup"
                  className="w-full lg:w-auto inline-flex justify-center items-center gap-2 text-[14px] font-medium px-6 py-3.5 rounded-lg btn-accent"
                >
                  Créer mon compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#flow"
                  className="text-[13px] font-medium"
                  style={{ color: "rgba(250,250,247,.7)" }}
                >
                  Comment ça marche →
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────
function FooterBar() {
  const cols = [
    {
      title: "Produit",
      links: ["Planificateur", "Bibliothèque", "Préparation", "Vision club", "Tarifs"],
    },
    {
      title: "Méthode",
      links: ["Principes de jeu", "Microcycles", "Mésocycles", "Pédagogie"],
    },
    {
      title: "Ressources",
      links: ["Blog", "Templates", "Centre d'aide", "API"],
    },
    {
      title: "Société",
      links: ["À propos", "Carrières", "Contact", "Mentions légales"],
    },
  ];
  return (
    <footer
      className="pt-16 pb-10"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2">
              <GrintaLogoIcon size={32} title="Grinta" />
              <GrintaLogoType height={18} title="GRINTA" />
            </div>
            <p
              className="mt-4 text-[13px] leading-relaxed max-w-xs"
              style={{ color: "var(--ink-3)", textWrap: "pretty" }}
            >
              L&apos;outil des entraîneurs et des clubs de football pour
              planifier la saison, construire les microcycles et préparer les
              entraînements.
            </p>
            <div
              className="mt-6 text-[11px] font-mono"
              style={{ color: "var(--ink-3)" }}
            >
              © 2026 Grinta · Made avec grinta.
            </div>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <div
                  className="text-[11px] font-mono uppercase tracking-widest"
                  style={{ color: "var(--ink-3)" }}
                >
                  {c.title}
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-[13px] hover:text-[var(--ink)] transition-colors"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
