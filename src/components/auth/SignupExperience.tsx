"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PersonaPicker, type PersonaChoice } from "@/components/auth/PersonaPicker";
import { SignupForm } from "@/components/auth/SignupForm";

export function SignupExperience({ next }: { next?: string }) {
  const tApp = useTranslations("app");
  const [persona, setPersona] = useState<PersonaChoice>("staff");

  return (
    <AuthSplit
      tone={persona}
      name={tApp("name")}
      tagline={tApp("tagline")}
      aside={<PersonaPicker value={persona} onChange={setPersona} />}
    >
      <div className="flex flex-col gap-6">
        <AuthTabs />
        <SignupForm persona={persona} />
        <OAuthButtons next={next} variant="icons" />
      </div>
    </AuthSplit>
  );
}
