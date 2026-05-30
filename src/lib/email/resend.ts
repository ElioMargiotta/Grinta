import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  cached = new Resend(key);
  return cached;
}

export function getResendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Grinta <invitations@grintaclub.app>";
}
