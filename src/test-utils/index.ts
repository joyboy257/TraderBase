/**
 * Test utilities — shared mock factories for unit tests.
 *
 * Mock conventions:
 * - All factories accept partial overrides so tests can customize
 * - Typed return values match the real dependency signatures
 * - Import from here in test files: `import { mockSupabaseClient } from '@/test-utils'`
 */

export {
  mockSupabaseClient,
  mockPlaidHoldings,
  mockPolygonTrade,
  mockRateLimit,
  type MockSupabaseClient,
  type HoldingsData,
  type PlaidHolding,
  type PlaidSecurity,
} from './mocks';
