import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    [k: string]: unknown;
  };
};

const STATUS_BY_TYPE: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "sent",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "opened",
  "email.failed": "failed",
};

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const body = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendEvent;
  } catch (err) {
    console.warn("[resend.webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const providerId = event.data?.email_id;
  if (!providerId) {
    return NextResponse.json({ ok: true, skipped: "no_email_id" });
  }

  const supabase = createServiceClient();

  const { data: invitation } = await supabase
    .from("club_invitations")
    .select("id, email_status")
    .eq("email_provider_id", providerId)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ ok: true, skipped: "no_invitation_match" });
  }

  const nextStatus = STATUS_BY_TYPE[event.type];
  if (nextStatus && nextStatus !== invitation.email_status) {
    // Don't downgrade: once delivered/opened, ignore later "sent" events.
    const priority: Record<string, number> = {
      pending: 0,
      failed: 1,
      sent: 2,
      bounced: 3,
      complained: 3,
      delivered: 4,
      opened: 5,
    };
    const current = priority[invitation.email_status ?? "pending"] ?? 0;
    const incoming = priority[nextStatus] ?? 0;
    if (incoming >= current) {
      await supabase
        .from("club_invitations")
        .update({ email_status: nextStatus })
        .eq("id", invitation.id);
    }
  }

  await supabase.from("club_invitation_events").insert({
    invitation_id: invitation.id,
    event_type: event.type,
    payload: event.data ?? {},
  });

  return NextResponse.json({ ok: true });
}
