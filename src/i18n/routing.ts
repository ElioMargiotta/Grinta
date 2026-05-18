import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "de", "it"],
  defaultLocale: "fr",
  localePrefix: "always",
});
