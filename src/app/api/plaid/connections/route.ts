import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getInvestmentHoldings, transformHoldingsToPositions } from "@/lib/plaid/client";
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

    // Sync all connections in parallel
    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        if (!conn.plaid_access_token_encrypted) return { conn, positions: [] };

        const { accounts, holdings, securities } = await getInvestmentHoldings(conn.plaid_access_token_encrypted);

        const positions = transformHoldingsToPositions(
          accounts,
          holdings,
          securities,
          user.id,
          conn.id
        );

        if (positions.length > 0) {
          await serviceClient.from("positions").upsert(positions, {
            onConflict: "user_id,brokerage_connection_id,ticker",
          });
        }

        return { conn, positions };
      })
    );

    const syncedCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.positions.length > 0
    ).length;

    // Log failures
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Failed to sync ${connections[i].brokerage_name}:`, r.reason);
      }
    });

    return NextResponse.json({ synced: syncedCount });
  } catch (error: unknown) {
    console.error("syncPositions error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync positions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
