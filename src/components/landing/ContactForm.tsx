"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { sendContactMessage } from "@/app/[locale]/contact/actions";

const fieldClass =
  "w-full rounded-lg bg-[var(--bg)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-3)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ink)]/15";

const labelClass =
  "text-[11px] font-mono uppercase tracking-widest text-[var(--ink-3)]";

export function ContactForm({ defaultMessage }: { defaultMessage?: string }) {
  const t = useTranslations("contact.form");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  if (status === "sent") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-2xl p-6"
        style={{ border: "1px solid var(--line)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          <Check className="h-4 w-4" />
        </div>
        <p className="text-[15px] font-medium text-[var(--ink)]">
          {t("successTitle")}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
          {t("successBody")}
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      action={(formData) => {
        setStatus("idle");
        formData.set("locale", locale);
        startTransition(async () => {
          const result = await sendContactMessage(formData);
          if (result.ok) {
            setStatus("sent");
            formRef.current?.reset();
          } else {
            setStatus("error");
          }
        });
      }}
    >
      {/* Honeypot: hidden from real users, catches bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="contact-name" className={labelClass}>
          {t("name")}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          className={fieldClass}
          style={{ border: "1px solid var(--line)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contact-email" className={labelClass}>
          {t("email")}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          className={fieldClass}
          style={{ border: "1px solid var(--line)" }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contact-message" className={labelClass}>
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          defaultValue={defaultMessage}
          placeholder={t("messagePlaceholder")}
          className={`${fieldClass} resize-y`}
          style={{ border: "1px solid var(--line)" }}
        />
      </div>

      {status === "error" && (
        <p
          className="rounded-lg px-3.5 py-2.5 text-[13px]"
          style={{
            border: "1px solid color-mix(in oklch, red 30%, var(--line))",
            color: "color-mix(in oklch, red 70%, var(--ink))",
          }}
        >
          {t("error")}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg px-4 py-2.5 text-[13px] font-medium btn-ink disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
        {!isPending && <ArrowRight className="h-3.5 w-3.5" />}
      </button>
    </form>
  );
}
