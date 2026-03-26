import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyWebhookToken } from "@/lib/plaid/client";
import { handleSyncUpdatesAvailable, handleItemError } from "@/lib/webhook/handlers/plaid";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function deriveEventId(body: Record<string, unknown>): string {
  const notificationId = body.notification_id as string | undefined;
  if (notificationId) return notificationId;
  const itemId = (body.item_id as string) ?? "";
  const webhookType = (body.webhook_type as string) ?? "";
  const webhookCode = (body.webhook_code as string) ?? "";
  const ts =
    ((body.created_at ?? body.timestamp) as string) ?? new Date().toISOString();
  return `${itemId}::${webhookType}::${webhookCode}::${ts}`;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  let rawBody: string;
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookType = body.webhook_type as string | undefined;
  const webhookCode = body.webhook_code as string | undefined;
  const itemId = body.item_id as string | undefined;
  const verificationHeader = request.headers.get("plaid-verification") ?? "";

  // Validate required fields
  if (!webhookType || !webhookCode || !itemId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the webhook is from Plaid, not a spoofed request
  if (verificationHeader) {
    const isValid = await verifyWebhookToken(rawBody, verificationHeader, itemId);
    if (!isValid) {
      console.error("Webhook verification failed for item_id:", itemId);
      return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
    }
  }

  // Insert-first pattern: queue the event before processing
  const serviceClient = getServiceClient();
  const eventId = deriveEventId(body);
  const { error: insertError } = await serviceClient
    .from("webhook_events")
    .insert({
      source: "plaid",
      event_id: eventId,
      webhook_type: webhookType,
      webhook_code: webhookCode,
      item_id: itemId,
      raw_payload: body,
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      next_retry_at: new Date().toISOString(),
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true }); // duplicate, already have it
    }
    console.error("Failed to queue webhook event:", insertError);
    return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });
  }

  // Dispatch handlers asynchronously after queue insert
  if (webhookType === "INVESTMENTS" && webhookCode === "SYNC_UPDATES_AVAILABLE") {
    handleSyncUpdatesAvailable(itemId).catch((err) =>
      console.error(`Webhook SYNC_UPDATES_AVAILABLE failed for item ${itemId}:`, err)
    );
  } else if (webhookType === "ITEM_ERROR") {
    handleItemError(itemId).catch((err) =>
      console.error(`Webhook ITEM_ERROR failed for item ${itemId}:`, err)
    );
  }

  return NextResponse.json({ received: true });
}
