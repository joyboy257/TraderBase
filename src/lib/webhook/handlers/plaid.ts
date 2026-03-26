import { createServerClient } from "@supabase/ssr";
import {
  getInvestmentHoldings,
  transformHoldingsToPositions,
  verifyPlaidWebhook,
} from "@/lib/plaid/client";
import { decrypt } from "@/lib/crypto";
import { upsertSecurityIdsFromHoldings } from "@/lib/plaid/security-cache";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function handleSyncUpdatesAvailable(
  itemId: string
): Promise<void> {
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

    // Upsert security_id_cache for all securities in this connection
    await upsertSecurityIdsFromHoldings(connection.id, securities);

    // Query the upserted positions to get their IDs for linking
    const tickers = positions.map((p) => p.ticker);
    const { data: upsertedPositions } = await serviceClient
      .from("positions")
      .select("id, ticker")
      .eq("user_id", connection.user_id)
      .eq("brokerage_connection_id", connection.id)
      .in("ticker", tickers);

    // Link any unlinked sltp_monitors to the newly upserted positions
    if (upsertedPositions && upsertedPositions.length > 0) {
      for (const pos of upsertedPositions) {
        await serviceClient
          .from("sltp_monitors")
          .update({ position_id: pos.id })
          .eq("user_id", connection.user_id)
          .eq("ticker", pos.ticker)
          .eq("brokerage_connection_id", connection.id)
          .is("position_id", null);
      }
    }
  }
}

export async function handleItemError(itemId: string): Promise<void> {
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
