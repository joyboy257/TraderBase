import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getInvestmentHoldings } from "@/lib/plaid/client";
import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: connections } = await supabase
      .from("brokerage_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("linked_at", { ascending: false });

    return NextResponse.json({ connections: connections ?? [] });
  } catch (error: unknown) {
    console.error("getConnections error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch connections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Sync positions for all connected accounts
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: connections } = await supabase
      .from("brokerage_connections")
      .select("id, plaid_access_token_encrypted, brokerage_name")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (!connections || connections.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    const serviceClient = getServiceClient();
    let syncedCount = 0;

    for (const conn of connections) {
      if (!conn.plaid_access_token_encrypted) continue;

      try {
        const { accounts, holdings, securities } = await getInvestmentHoldings(conn.plaid_access_token_encrypted);

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
              user_id: user.id,
              brokerage_connection_id: conn.id,
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

        syncedCount++;
      } catch (connError) {
        console.error(`Failed to sync ${conn.brokerage_name}:`, connError);
      }
    }

    return NextResponse.json({ synced: syncedCount });
  } catch (error: unknown) {
    console.error("syncPositions error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync positions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
