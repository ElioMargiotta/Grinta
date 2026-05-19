"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  createClubPlayerAction,
  updateClubPlayerAction,
} from "@/app/[locale]/(app)/contingent/actions";

export type EditablePlayer = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  position: string | null;
  jersey_number: number | null;
  notes: string | null;
  strong_foot: string | null;
  license_number: string | null;
  js_number: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  canton: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian2_name: string | null;
  guardian2_email: string | null;
  guardian2_phone: string | null;
};

export function ClubPlayerForm({ player }: { player?: EditablePlayer }) {
  const t = useTranslations("contingent.form");
  const locale = useLocale();
  const router = useRouter();
  const isEdit = Boolean(player);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 sm:grid-cols-2"
      action={(formData) => {
        setError(null);
        setSaved(false);
        formData.set("locale", locale);
        if (player) formData.set("playerId", player.id);
        startTransition(async () => {
          const result = isEdit
            ? await updateClubPlayerAction(formData)
            : await createClubPlayerAction(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (isEdit) {
            setSaved(true);
            router.refresh();
          } else {
            formRef.current?.reset();
          }
        });
      }}
    >
      <Input
        id="firstName"
        name="firstName"
        label={t("firstName")}
        required
        defaultValue={player?.first_name ?? ""}
      />
      <Input
        id="lastName"
        name="lastName"
        label={t("lastName")}
        required
        defaultValue={player?.last_name ?? ""}
      />
      <Input
        id="birthDate"
        name="birthDate"
        type="date"
        label={t("birthDate")}
        defaultValue={player?.birth_date ?? ""}
      />
      <Input
        id="position"
        name="position"
        label={t("position")}
        placeholder={t("positionPlaceholder")}
        defaultValue={player?.position ?? ""}
      />
      <Input
        id="jerseyNumber"
        name="jerseyNumber"
        type="number"
        min={0}
        max={99}
        label={t("jersey")}
        defaultValue={player?.jersey_number ?? ""}
      />
      <div className="sm:col-span-2">
        <Textarea
          id="notes"
          name="notes"
          label={t("notes")}
          defaultValue={player?.notes ?? ""}
        />
      </div>

      <details
        className="sm:col-span-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
        open={Boolean(
          player &&
            (player.license_number ||
              player.js_number ||
              player.email ||
              player.phone ||
              player.address),
        )}
      >
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("moreDetails")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            id="licenseNumber"
            name="licenseNumber"
            label={t("licenseNumber")}
            defaultValue={player?.license_number ?? ""}
          />
          <Input
            id="jsNumber"
            name="jsNumber"
            label={t("jsNumber")}
            defaultValue={player?.js_number ?? ""}
          />
          <Select
            id="strongFoot"
            name="strongFoot"
            label={t("strongFoot")}
            defaultValue={player?.strong_foot ?? ""}
          >
            <option value="">—</option>
            <option value="left">{t("footLeft")}</option>
            <option value="right">{t("footRight")}</option>
            <option value="both">{t("footBoth")}</option>
          </Select>
          <Input
            id="nationality"
            name="nationality"
            label={t("nationality")}
            defaultValue={player?.nationality ?? ""}
          />
          <Input
            id="email"
            name="email"
            type="email"
            label={t("email")}
            defaultValue={player?.email ?? ""}
          />
          <Input
            id="phone"
            name="phone"
            label={t("phone")}
            defaultValue={player?.phone ?? ""}
          />
          <div className="sm:col-span-2">
            <Input
              id="address"
              name="address"
              label={t("address")}
              defaultValue={player?.address ?? ""}
            />
          </div>
          <Input
            id="postalCode"
            name="postalCode"
            label={t("postalCode")}
            defaultValue={player?.postal_code ?? ""}
          />
          <Input
            id="city"
            name="city"
            label={t("city")}
            defaultValue={player?.city ?? ""}
          />
          <Input
            id="canton"
            name="canton"
            label={t("canton")}
            defaultValue={player?.canton ?? ""}
          />
          <div className="sm:col-span-2 mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t("guardianSection")}
          </div>
          <Input
            id="guardianName"
            name="guardianName"
            label={t("guardianName")}
            defaultValue={player?.guardian_name ?? ""}
          />
          <Input
            id="guardianPhone"
            name="guardianPhone"
            label={t("guardianPhone")}
            defaultValue={player?.guardian_phone ?? ""}
          />
          <div className="sm:col-span-2">
            <Input
              id="guardianEmail"
              name="guardianEmail"
              type="email"
              label={t("guardianEmail")}
              defaultValue={player?.guardian_email ?? ""}
            />
          </div>
          <Input
            id="guardian2Name"
            name="guardian2Name"
            label={t("guardian2Name")}
            defaultValue={player?.guardian2_name ?? ""}
          />
          <Input
            id="guardian2Phone"
            name="guardian2Phone"
            label={t("guardian2Phone")}
            defaultValue={player?.guardian2_phone ?? ""}
          />
          <div className="sm:col-span-2">
            <Input
              id="guardian2Email"
              name="guardian2Email"
              type="email"
              label={t("guardian2Email")}
              defaultValue={player?.guardian2_email ?? ""}
            />
          </div>
        </div>
      </details>

      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="sm:col-span-2 text-sm text-emerald-700 dark:text-emerald-300">
          {t("saved")}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={isPending} loadingLabel={t("saving")}>
          {isEdit ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
