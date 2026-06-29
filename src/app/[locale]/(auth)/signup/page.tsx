import { setRequestLocale } from "next-intl/server";
import { SignupExperience } from "@/components/auth/SignupExperience";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  return <SignupExperience next={next} />;
}
