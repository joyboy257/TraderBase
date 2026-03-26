import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getInvestmentHoldings, transformHoldingsToPositions, verifyWebhookToken, verifyPlaidWebhook } from "@/lib/plaid/client";
import { decrypt } from "@/lib/crypto";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
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

  // Handle INVESTMENTS product webhooks (not TRANSACTIONS product)
  if (webhookType === "INVESTMENTS" && webhookCode === "SYNC_UPDATES_AVAILABLE") {
    // Fire-and-forget is intentional — Plaid requires 200 fast, positions sync async
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

async function handleSyncUpdatesAvailable(itemId: string): Promise<void> {
  const serviceClient = getServiceClient();

  const { data: connection, error } = await serviceClient
    .from("brokerage_connections")
    .select("id, user_id, plaid_access_token_encrypted")
    .eq("plaid_item_id", itemId)
    .eq("is_active", true)
    .single();

  if (error || !connection) {
    console.error("Connection not found for item_id:", itemId);
    return;
  }

  const rawToken = decrypt(connection.plaid_access_token_encrypted);
  const isValid = await verifyPlaidWebhook(rawToken);
  if (!isValid) {
    console.error("Webhook verification failed for item_id:", itemId);
    return;
  }

  const { accounts, holdings, securities } = await getInvestmentHoldings(
    connection.plaid_access_token_encrypted
  );

  const positions = transformHoldingsToPositions(
    accounts,
    holdings,
    securities,
    connection.user_id,
    connection.id
  );

  if (positions.length > 0) {
    await serviceClient.from("positions").upsert(positions, {
      onConflict: "user_id,brokerage_connection_id,ticker",
    });
  }
}

async function handleItemError(itemId: string): Promise<void> {
  const serviceClient = getServiceClient();

  const { data: connection } = await serviceClient
    .from("brokerage_connections")
    .select("plaid_access_token_encrypted")
    .eq("plaid_item_id", itemId)
    .eq("is_active", true)
    .single();

  if (!connection?.plaid_access_token_encrypted) {
    console.error("Connection not found for item_id:", itemId);
    return;
  }

  const rawToken = decrypt(connection.plaid_access_token_encrypted);
  const isValid = await verifyPlaidWebhook(rawToken);
  if (!isValid) {
    console.error("Webhook verification failed for item_id:", itemId);
    return;
  }

  const { error } = await serviceClient
    .from("brokerage_connections")
    .update({ is_active: false })
    .eq("plaid_item_id", itemId)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to deactivate connection for item_id:", itemId, error);
    return;
  }

  console.warn("Brokerage connection deactivated due to ITEM_ERROR:", itemId);
  // TODO: Notify user via email or in-app notification
}
