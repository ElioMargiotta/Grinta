"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { respondToSessionAction } from "@/app/[locale]/(player)/actions";

const KNOWN_ERROR_KEYS = new Set([
  "unauthenticated",
  "reason_required_when_absent",
  "session_not_found",
  "club_inactive",
  "not_assigned_to_team",
  "deadline_passed",
  "missing_session",
  "invalid_status",
]);

function translateError(
  t: (key: string) => string,
  code: string,
): string {
  return t(KNOWN_ERROR_KEYS.has(code) ? `errors.${code}` : "errors.unknown");
}

type Props = {
  sessionId: string;
  playerId: string;
  deadlinePassed: boolean;
  initialStatus: "present" | "absent" | null;
  initialReason: string | null;
};

export function AttendanceRSVP({
  sessionId,
  playerId,
  deadlinePassed,
  initialStatus,
  initialReason,
}: Props) {
  const t = useTranslations("attendance");
  const locale = useLocale();
  const [status, setStatus] = useState(initialStatus);
  const [reason, setReason] = useState(initialReason ?? "");
  const [askingReason, setAskingReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (next: "present" | "absent", justification?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await respondToSessionAction({
        sessionId,
        playerId,
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

  if (deadlinePassed) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{t("deadlinePassed")}</span>
        {status && (
          <span className="ml-auto font-medium">
            · {status === "present" ? t("answeredPresent") : t("answeredAbsent")}
          </span>
        )}
      </div>
    );
  }

  if (askingReason) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) {
            setError(translateError(t, "reason_required_when_absent"));
            return;
          }
          submit("absent", reason.trim());
        }}
      >
        <Textarea
          id="rsvp-reason"
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
          variant={status === "present" ? "primary" : "secondary"}
          size="sm"
          onClick={() => submit("present")}
          disabled={isPending}
        >
          <Check className="h-3.5 w-3.5" />
          {t("present")}
        </Button>
        <Button
          type="button"
          variant={status === "absent" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setAskingReason(true)}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5" />
          {t("absent")}
        </Button>
        {status && !isPending && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {status === "present" ? t("answeredPresent") : t("answeredAbsent")}
          </span>
        )}
      </div>
      {status === "absent" && reason && (
        <p className="text-[12px] italic text-muted-foreground">
          « {reason} »
        </p>
      )}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
