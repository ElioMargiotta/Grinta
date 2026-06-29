"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { respondToMatchAction } from "@/app/[locale]/(player)/actions";

const KNOWN_ERROR_KEYS = new Set([
  "unauthenticated",
  "invalid_status",
  "reason_required_when_unavailable",
  "match_not_found",
  "club_inactive",
  "match_finished",
  "not_assigned_to_team",
  "not_called_up",
  "missing_match",
]);

function translateError(t: (key: string) => string, code: string): string {
  return t(KNOWN_ERROR_KEYS.has(code) ? `errors.${code}` : "errors.unknown");
}

type Props = {
  matchId: string;
  initialStatus: "available" | "unavailable" | null;
  initialReason: string | null;
};

export function MatchRSVP({ matchId, initialStatus, initialReason }: Props) {
  const t = useTranslations("matchRsvp");
  const locale = useLocale();
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(initialReason ?? "");
  const [askingReason, setAskingReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (next: "available" | "unavailable", justification?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await respondToMatchAction({
        matchId,
        status: next,
        reason: justification,
        locale,
      });
      if (result.error) {
        setError(translateError(t, result.error));
        return;
      }
      setStatus(next);
      setReason(justification ?? "");
      setAskingReason(false);
    });
  };

  if (askingReason) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) {
            setError(translateError(t, "reason_required_when_unavailable"));
            return;
          }
          submit("unavailable", reason.trim());
        }}
      >
        <Textarea
          id="match-rsvp-reason"
          name="reason"
          label={t("reasonLabel")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          required
        />
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={isPending}>
            {t("confirmAbsent")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAskingReason(false);
              setError(null);
            }}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={status === "available" ? "primary" : "secondary"}
          size="sm"
          onClick={() => submit("available")}
          disabled={isPending}
        >
          <Check className="h-3.5 w-3.5" />
          {t("present")}
        </Button>
        <Button
          type="button"
          variant={status === "unavailable" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setAskingReason(true)}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
          {t("absent")}
        </Button>
        {status && !isPending && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {status === "available" ? t("answeredPresent") : t("answeredAbsent")}
          </span>
        )}
      </div>
      {status === "unavailable" && reason && (
        <p className="text-[12px] italic text-muted-foreground">
          « {reason} »
        </p>
      )}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
