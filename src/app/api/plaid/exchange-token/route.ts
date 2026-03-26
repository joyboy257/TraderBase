import { createClient } from "@/lib/supabase/server";
import { exchangePublicToken, getInvestmentHoldings, getAccounts, transformHoldingsToPositions } from "@/lib/plaid/client";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AccountType } from "plaid";

// Service role client for writing to protected tables
function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { public_token, metadata } = body as {
      public_token: string;
      metadata: {
        institution?: { name?: string; institution_id?: string };
        accounts?: Array<{ id?: string; name?: string; type?: string; subtype?: string }>;
      };
    };

    if (!public_token) {
      return NextResponse.json({ error: "public_token is required" }, { status: 400 });
    }

    // Exchange public token for access token
    const { access_token, item_id } = await exchangePublicToken(public_token);

    const serviceClient = getServiceClient();

    // Get account details for the primary investment account
    let accountId: string | null = null;
    let brokerageName = metadata?.institution?.name ?? "Unknown Brokerage";

    try {
      const accountsResponse = await getAccounts(access_token);
      const investmentAccount = accountsResponse.accounts.find(
        (acc) => acc.type === AccountType.Investment
      );
      accountId = investmentAccount?.account_id ?? accountsResponse.accounts[0]?.account_id ?? null;
    } catch {
      // Non-fatal — continue without account details
    }

    // Store the connection in the database
    // NOTE: In production, access_token should be encrypted at rest.
    // For now we store it directly — add AES-256-GCM encryption before production.
    const { data: connection, error: dbError } = await serviceClient
      .from("brokerage_connections")
      .insert({
        user_id: user.id,
        plaid_access_token_encrypted: access_token,
        plaid_item_id: item_id,
        brokerage_name: brokerageName,
        account_id: accountId,
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to store brokerage connection:", dbError);
      return NextResponse.json(
        { error: "Failed to store brokerage connection" },
        { status: 500 }
      );
    }

    // Sync positions immediately
    try {
      const { accounts, holdings, securities } = await getInvestmentHoldings(access_token);

      const positions = transformHoldingsToPositions(
        accounts,
        holdings,
        securities,
        user.id,
        connection.id
      );

      if (positions.length > 0) {
        await serviceClient.from("positions").upsert(positions, {
          onConflict: "user_id,brokerage_connection_id,ticker",
        });
      }
    } catch (syncError) {
      // Non-fatal — positions will sync via webhook later
      console.error("Position sync failed (will retry via webhook):", syncError);
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        brokerage_name: brokerageName,
        is_active: true,
      },
    });
  } catch (error: unknown) {
    console.error("exchange-token error:", error);
    const message = error instanceof Error ? error.message : "Failed to exchange token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
