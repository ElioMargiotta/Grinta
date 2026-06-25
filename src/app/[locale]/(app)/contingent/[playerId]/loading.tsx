import { getTranslations } from "next-intl/server";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

// Segment-scoped loading boundary. The global (app)/loading.tsx is an already
// resolved Suspense boundary, so React keeps the previous content during a
// sub-navigation instead of re-showing it; a fresh boundary on the [playerId]
// segment makes the waiting screen appear immediately on click.
export default async function ContingentPlayerLoading() {
  const t = await getTranslations("common");
  return (
    <LoadingOverlay
      fullscreen
      label={t("loading")}
      message={t("pleaseWait")}
    />
  );
}
