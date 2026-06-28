import { setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative min-h-screen">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LocaleSwitcher variant="subtle" />
      </div>
      {children}
    </div>
  );
}
