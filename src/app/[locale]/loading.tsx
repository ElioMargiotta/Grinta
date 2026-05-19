import { getTranslations } from "next-intl/server";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export default async function LocaleRouteLoading() {
  const t = await getTranslations("common");
  return (
    <LoadingOverlay
      fullscreen
      label={t("loading")}
      message={t("pleaseWait")}
    />
  );
}
