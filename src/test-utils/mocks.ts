/**
 * Shared mock factories for unit tests.
 * These mocks replace real external dependencies (Supabase, Plaid, Polygon).
 */

// ---------------------------------------------------------------------------
// Supabase client mock
// ---------------------------------------------------------------------------

export interface MockSupabaseChain {
  select: () => MockSupabaseChain;
  insert: () => MockSupabaseChain;
  update: () => MockSupabaseChain;
  delete: () => MockSupabaseChain;
  upsert: () => MockSupabaseChain;
  eq: () => MockSupabaseChain;
  single: () => Promise<{ data: unknown; error: unknown | null }>;
}

function createMockQueryBuilder(data: unknown, error: unknown | null = null): MockSupabaseChain {
  return {
    select: () => createMockQueryBuilder(data, error),
    insert: () => createMockQueryBuilder(data, error),
    update: () => createMockQueryBuilder(data, error),
    delete: () => createMockQueryBuilder(data, error),
    upsert: () => createMockQueryBuilder(data, error),
    eq: () => createMockQueryBuilder(data, error),
    single: () => Promise.resolve({ data, error }),
  };
}

export interface MockSupabaseClient {
  from: (table: string) => MockSupabaseChain;
}

export function mockSupabaseClient(overrides?: Partial<Record<string, MockSupabaseChain>>): MockSupabaseClient {
  return {
    from: (table: string) => {
      if (overrides?.[table]) {
        return overrides[table]!;
      }
      return createMockQueryBuilder(null, null);
    },
  };
}

// ---------------------------------------------------------------------------
// Plaid holdings mock
// ---------------------------------------------------------------------------

export interface PlaidHolding {
  security_id: string;
  quantity: number;
  institution_price: number;
  institution_value: number;
  account_id: string;
}

export interface PlaidSecurity {
  security_id: string;
  ticker_symbol: string | null;
  name: string | null;
}

export interface HoldingsData {
  holdings: PlaidHolding[];
  securities: PlaidSecurity[];
}

export function mockPlaidHoldings(
  { holdings = [], securities = [] }: Partial<HoldingsData> = {}
): HoldingsData {
  return { holdings, securities };
}

// ---------------------------------------------------------------------------
// Polygon trade mock
// ---------------------------------------------------------------------------

export function mockPolygonTrade(price: number): { price: number; timestamp: string } {
  return { price, timestamp: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Rate limit mock
// ---------------------------------------------------------------------------

export function mockRateLimit(allowed: boolean): { allowed: boolean; remaining: number } {
  return { allowed, remaining: allowed ? 9 : 0 };
}
