import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPlaidHoldings, mockRateLimit } from '@/test-utils';

// ---------------------------------------------------------------------------
// Mock createServerClient from @supabase/ssr — this is what getServiceClient calls
// ---------------------------------------------------------------------------
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock Plaid client
// ---------------------------------------------------------------------------
vi.mock('@/lib/plaid/client', () => ({
  getInvestmentHoldings: vi.fn(),
  postInvestmentOrder: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock rate-limit
// ---------------------------------------------------------------------------
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock crypto
// ---------------------------------------------------------------------------
vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn((val: string) => val),
}));

// Import after mocks are defined
import { executeCopyTrade } from './executor';
import { createServerClient } from '@supabase/ssr';
import { getInvestmentHoldings, postInvestmentOrder } from '@/lib/plaid/client';
import { checkRateLimit } from '@/lib/rate-limit';

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;
const mockGetInvestmentHoldings = getInvestmentHoldings as ReturnType<typeof vi.fn>;
const mockPostInvestmentOrder = postInvestmentOrder as ReturnType<typeof vi.fn>;
const mockCheckRateLimit = checkRateLimit as ReturnType<typeof vi.fn>;

const TEST_USER_ID = 'user-123';
const TEST_SIGNAL_ID = 'signal-456';
const TEST_BROKERAGE_ID = 'brokerage-789';

function createBasicSignal(overrides: Partial<{
  action: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
}> = {}) {
  return {
    id: TEST_SIGNAL_ID,
    user_id: 'leader-001',
    ticker: 'AAPL',
    action: 'BUY' as const,
    entry_price: 150,
    stop_loss: 145,
    take_profit: 165,
    is_active: true,
    ...overrides,
  };
}

function createBasicFollow() {
  return {
    id: 'follow-001',
    follower_id: TEST_USER_ID,
    leader_id: 'leader-001',
    copy_ratio: 0.5,
    max_position_size: 1000,
    is_active: true,
  };
}

function createBasicBrokerage() {
  return {
    id: TEST_BROKERAGE_ID,
    user_id: TEST_USER_ID,
    plaid_access_token_encrypted: 'plain-token',
    account_id: 'acct-001',
  };
}

function createMockFromChain(tableResponses: Record<string, { data: unknown; error: unknown | null }>) {
  return (table: string) => {
    const response = tableResponses[table] ?? { data: null, error: null };
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      upsert: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: response.data, error: response.error })),
    };
    // Make methods return themselves for chaining
    Object.keys(chain).forEach((key) => {
      if (typeof chain[key] === 'function') {
        (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      }
    });
    return chain;
  };
}

describe('executeCopyTrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue(mockRateLimit(true));
    // Reset createServerClient mock
    mockCreateServerClient.mockReturnValue({
      from: createMockFromChain({}),
    } as unknown as ReturnType<typeof createServerClient>);
  });

  it(' Winner path: INSERT returns a row, Plaid is called, row updated to executed', async () => {
    const signal = createBasicSignal();
    const follow = createBasicFollow();
    const brokerage = createBasicBrokerage();
    const upsertResult = { id: 'trade-001', status: 'pending' };
    const holdingsData = mockPlaidHoldings({
      holdings: [
        { security_id: 'sec-001', quantity: 10, institution_price: 150, institution_value: 1500, account_id: 'acct-001' },
      ],
      securities: [
        { security_id: 'sec-001', ticker_symbol: 'AAPL', name: 'Apple Inc' },
      ],
    });

    const mockClient = {
      from: createMockFromChain({
        signals: { data: signal, error: null },
        follows: { data: follow, error: null },
        brokerage_connections: { data: brokerage, error: null },
        copied_trades: { data: upsertResult, error: null },
      }) as never,
    };

    mockCreateServerClient.mockReturnValue(mockClient as never);
    mockGetInvestmentHoldings.mockResolvedValue(holdingsData);
    mockPostInvestmentOrder.mockResolvedValue({ request_id: 'req-001', order_id: 'order-001' });

    const result = await executeCopyTrade(TEST_USER_ID, TEST_SIGNAL_ID);

    expect(result.success).toBe(true);
    expect(result.copied_trade_id).toBe('trade-001');
    expect(mockPostInvestmentOrder).toHaveBeenCalled();
  });

  it(' Loser path: INSERT returns null (duplicate key), existing row returned as success, Plaid NOT called', async () => {
    const signal = createBasicSignal();
    const follow = createBasicFollow();
    const brokerage = createBasicBrokerage();
    const existingRow = { id: 'existing-trade', status: 'pending' };

    const mockClient = {
      from: createMockFromChain({
        signals: { data: signal, error: null },
        follows: { data: follow, error: null },
        brokerage_connections: { data: brokerage, error: null },
        copied_trades: { data: null, error: null }, // upsert returns null for loser
      }) as never,
    };

    mockCreateServerClient.mockReturnValue(mockClient as never);

    const result = await executeCopyTrade(TEST_USER_ID, TEST_SIGNAL_ID);

    expect(result.success).toBe(true);
    expect(result.copied_trade_id).toBe('existing-trade');
    // Plaid should NOT be called for loser path
    expect(mockPostInvestmentOrder).not.toHaveBeenCalled();
  });

  it(' SELL no position: holdings.find() returns undefined, row updated to failed with error', async () => {
    const signal = createBasicSignal({ action: 'SELL' });
    const follow = createBasicFollow();
    const brokerage = createBasicBrokerage();
    const upsertResult = { id: 'trade-sell-001', status: 'pending' };

    const mockClient = {
      from: createMockFromChain({
        signals: { data: signal, error: null },
        follows: { data: follow, error: null },
        brokerage_connections: { data: brokerage, error: null },
        copied_trades: { data: upsertResult, error: null },
      }) as never,
    };

    mockCreateServerClient.mockReturnValue(mockClient as never);
    // Empty holdings - no position to sell
    mockGetInvestmentHoldings.mockResolvedValue(mockPlaidHoldings({ holdings: [], securities: [] }));

    const result = await executeCopyTrade(TEST_USER_ID, TEST_SIGNAL_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No position found');
    expect(mockPostInvestmentOrder).not.toHaveBeenCalled();
  });

  it(' Plaid API failure: postInvestmentOrder throws, row updated to failed with error_message', async () => {
    const signal = createBasicSignal();
    const follow = createBasicFollow();
    const brokerage = createBasicBrokerage();
    const upsertResult = { id: 'trade-002', status: 'pending' };
    const holdingsData = mockPlaidHoldings({
      holdings: [
        { security_id: 'sec-001', quantity: 10, institution_price: 150, institution_value: 1500, account_id: 'acct-001' },
      ],
      securities: [
        { security_id: 'sec-001', ticker_symbol: 'AAPL', name: 'Apple Inc' },
      ],
    });

    const mockClient = {
      from: createMockFromChain({
        signals: { data: signal, error: null },
        follows: { data: follow, error: null },
        brokerage_connections: { data: brokerage, error: null },
        copied_trades: { data: upsertResult, error: null },
      }) as never,
    };

    mockCreateServerClient.mockReturnValue(mockClient as never);
    mockGetInvestmentHoldings.mockResolvedValue(holdingsData);
    mockPostInvestmentOrder.mockRejectedValue(new Error('Plaid API error: connection timeout'));

    const result = await executeCopyTrade(TEST_USER_ID, TEST_SIGNAL_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Plaid API error');
    expect(result.error).toContain('connection timeout');
  });

  it(' Rate limited: checkRateLimit returns allowed: false, returns rate limit error', async () => {
    mockCheckRateLimit.mockReturnValue(mockRateLimit(false));

    const result = await executeCopyTrade(TEST_USER_ID, TEST_SIGNAL_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
    // No service client calls should happen
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});
