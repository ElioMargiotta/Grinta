"use server";

import { getResend, getResendFromAddress } from "@/lib/email/resend";

const CONTACT_TO = process.env.CONTACT_TO_EMAIL ?? "contact@grinta.app";

export type ContactActionResult =
  | { ok: true }
  | { ok: false; errorCode: "invalid" | "send_failed" };

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactMessage(
  formData: FormData,
): Promise<ContactActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const locale = String(formData.get("locale") ?? "fr").trim();

  // Honeypot: real users leave it empty. Pretend success for bots.
  const honeypot = String(formData.get("company") ?? "").trim();
  if (honeypot) return { ok: true };

  if (!name || !message || !isValidEmail(email)) {
    return { ok: false, errorCode: "invalid" };
  }

  const subject = `[Contact] ${name}`;
  const html = [
    `<p><strong>Nom :</strong> ${escapeHtml(name)}</p>`,
    `<p><strong>E-mail :</strong> ${escapeHtml(email)}</p>`,
    `<p><strong>Langue :</strong> ${escapeHtml(locale)}</p>`,
    `<hr />`,
    `<p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
  ].join("");
  const text = [
    `Nom : ${name}`,
    `E-mail : ${email}`,
    `Langue : ${locale}`,
    "",
    message,
  ].join("\n");

  try {
    const result = await getResend().emails.send({
      from: getResendFromAddress(),
      to: CONTACT_TO,
      replyTo: email,
      subject,
      html,
      text,
      tags: [{ name: "kind", value: "contact" }],
    });
    if (result.error) {
      console.error("[sendContactMessage] failed", {
        from: getResendFromAddress(),
        reason: result.error.message,
      });
      return { ok: false, errorCode: "send_failed" };
    }
  } catch (err) {
    console.error("[sendContactMessage] failed", {
      from: getResendFromAddress(),
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    return { ok: false, errorCode: "send_failed" };
  }

  return { ok: true };
}
