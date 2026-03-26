import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Plaid security object as returned by getInvestmentHoldings.
 */
export interface PlaidSecurity {
  security_id: string;
  ticker_symbol?: string;
  name?: string;
}

/**
 * Get a single security_id from cache for a given connection and ticker.
 * Returns null on cache miss.
 */
export async function getSecurityId(
  connectionId: string,
  ticker: string
): Promise<string | null> {
  const serviceClient = getServiceClient();
  const { data } = await serviceClient
    .from("security_id_cache")
    .select("security_id")
    .eq("brokerage_connection_id", connectionId)
    .eq("ticker", ticker)
    .single();

  return data?.security_id ?? null;
}

/**
 * Batch lookup of security_ids from cache for a given connection and list of tickers.
 * Returns a Map of ticker -> security_id. Missing entries are not included.
 */
export async function getSecurityIdsBatch(
  connectionId: string,
  tickers: string[]
): Promise<Map<string, string>> {
  if (tickers.length === 0) return new Map();

  const serviceClient = getServiceClient();
  const { data } = await serviceClient
    .from("security_id_cache")
    .select("ticker, security_id")
    .eq("brokerage_connection_id", connectionId)
    .in("ticker", tickers);

  const map = new Map<string, string>();
  if (data) {
    for (const row of data) {
      map.set(row.ticker, row.security_id);
    }
  }
  return map;
}

/**
 * Upsert security_id entries from a Plaid holdings sync.
 * Called at holdings sync time (exchange-token, connections, webhooks).
 */
export async function upsertSecurityIdsFromHoldings(
  connectionId: string,
  securities: PlaidSecurity[]
): Promise<void> {
  if (securities.length === 0) return;

  const serviceClient = getServiceClient();
  const rows = securities
    .filter((s) => s.security_id && s.ticker_symbol)
    .map((s) => ({
      brokerage_connection_id: connectionId,
      ticker: s.ticker_symbol!,
      security_id: s.security_id,
      security_name: s.name ?? null,
    }));

  if (rows.length === 0) return;

  await serviceClient.from("security_id_cache").upsert(rows, {
    onConflict: "brokerage_connection_id,ticker",
  });
}

/**
 * Re-fetch all securities from Plaid and refresh the cache.
 * Called on cache miss to populate cache for a connection.
 */
export async function refreshSecurityIds(
  connectionId: string,
  accessToken: string
): Promise<void> {
  // Dynamically import to avoid circular deps — getInvestmentHoldings lives in plaid/client
  const { getInvestmentHoldings } = await import("@/lib/plaid/client");
  const { securities } = await getInvestmentHoldings(accessToken);
  await upsertSecurityIdsFromHoldings(connectionId, securities);
}
