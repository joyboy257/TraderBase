import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { verifyPlaidWebhook, getInvestmentHoldings } from "@/lib/plaid/client";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const webhookType = body.webhook_type as string;
  const webhookCode = body.webhook_code as string;

  // Return 200 quickly — heavy processing happens async
  ;(async () => {
    try {
      if (webhookType === "TRANSACTIONS_SYNC" || webhookCode === "SYNC_UPDATES_AVAILABLE") {
        await handleTransactionsSync(body);
      } else if (webhookType === "ITEM_ERROR") {
        await handleItemError(body);
      }
    } catch (err) {
      console.error(`Webhook processing error [${webhookType}/${webhookCode}]:`, err);
    }
  })();

  return NextResponse.json({ received: true });
}

async function handleTransactionsSync(payload: {
  item_id: string;
  webhook_code: string;
}) {
  const serviceClient = getServiceClient();

  // Find the connection for this item_id
  const { data: connection, error } = await serviceClient
    .from("brokerage_connections")
    .select("id, user_id, plaid_access_token_encrypted")
    .eq("plaid_item_id", payload.item_id)
    .eq("is_active", true)
    .single();

  if (error || !connection) {
    console.error("Connection not found for item_id:", payload.item_id);
    return;
  }

  const accessToken = connection.plaid_access_token_encrypted;

  // Verify the webhook is legitimate
  const isValid = await verifyPlaidWebhook(accessToken);
  if (!isValid) return;

  // Sync positions
  const { accounts, holdings, securities } = await getInvestmentHoldings(accessToken);

  const positions = accounts.flatMap((account) => {
    const accountHoldings = holdings.filter(
      (h) => h.account_id === account.account_id && h.quantity > 0
    );

    return accountHoldings.map((holding) => {
      const security = securities.find(
        (s) => s.security_id === holding.security_id
      )!;
      const quantity = holding.quantity;
      const lastPrice = holding.institution_price ?? 0;
      const costBasis = holding.institution_value ?? 0;

      return {
        user_id: connection.user_id,
        brokerage_connection_id: connection.id,
        ticker: security.ticker_symbol ?? security.name ?? "UNKNOWN",
        quantity,
        average_cost: quantity > 0 ? costBasis / quantity : 0,
        current_price: lastPrice,
        unrealized_pnl: lastPrice * quantity - costBasis,
      };
    });
  }).filter((p) => p.ticker !== "UNKNOWN" && p.quantity > 0);

  if (positions.length > 0) {
    await serviceClient.from("positions").upsert(positions, {
      onConflict: "user_id,brokerage_connection_id,ticker",
    });
  }
}

async function handleItemError(payload: { item_id: string }) {
  const serviceClient = getServiceClient();

  // Find the connection to get the access token for verification
  const { data: connection } = await serviceClient
    .from("brokerage_connections")
    .select("plaid_access_token_encrypted")
    .eq("plaid_item_id", payload.item_id)
    .eq("is_active", true)
    .single();

  if (!connection?.plaid_access_token_encrypted) {
    console.error("Connection not found for item_id:", payload.item_id);
    return;
  }

  // Verify the webhook is legitimate
  const isValid = await verifyPlaidWebhook(connection.plaid_access_token_encrypted);
  if (!isValid) return;

  // Find and deactivate the connection
  const { error } = await serviceClient
    .from("brokerage_connections")
    .update({ is_active: false })
    .eq("plaid_item_id", payload.item_id)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to deactivate connection for item_id:", payload.item_id, error);
    return;
  }

  // TODO: Notify user via email or in-app notification
  console.warn("Brokerage connection deactivated due to ITEM_ERROR:", payload.item_id);
}
