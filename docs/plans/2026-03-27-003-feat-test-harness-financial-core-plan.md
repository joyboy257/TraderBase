---
title: "feat: Test Harness for Financial Core Paths"
type: feat
status: active
date: 2026-03-27
origin: docs/ideation/2026-03-27-open-ideation.md
deepened: 2026-03-27
---

# feat: Test Harness for Financial Core Paths

## Overview

Set up Vitest and write targeted tests for the two highest-risk files in the codebase: `executor.ts` (copy trading race logic) and `monitor.ts` (SL/TP trigger evaluation). Not full coverage — only the 5 paths where bugs move real money.

## Problem Frame

Zero test files exist. `executor.ts` handles winner/loser race conditions, SELL-with-no-position branches, and Plaid API failures. `monitor.ts` evaluates SL/TP/trailing triggers. Both are pure financial logic that should have been tested from day one.

## Requirements Trace

- R1. Vitest is configured and `npm test` runs without errors
- R2. `executor.ts` winner/loser, SELL-no-position, and Plaid-failure paths are covered
- R3. `monitor.ts` SL/TP/trailing trigger logic and market-closed skip are covered
- R4. Mock factories are shared and reusable across test files

## Scope Boundaries

- No E2E tests
- No integration tests with real Supabase/Plaid/Polygon
- `getServiceClient()` is mocked, not the real Supabase client
- Test patterns established here should be used for future test-writing (not a one-off)

## Key Technical Decisions

- **Test runner:** Vitest — already in the npm ecosystem (no new toolchain), compatible with TypeScript, fast
- **Mock approach:** Module-level mocks using `vi.mock()` for `getServiceClient`, `getInvestmentHoldings`, `postInvestmentOrder`, `getLastTrade`. The pure functions (`evaluateTrailingStop`, `deriveIdempotencyKey`) don't need mocking.
- **Test structure:** `describe` blocks per function, `it` cases per scenario. One assertion per `it` — no mega-assertion tests.
- **Mock factories:** `src/test-utils/` with `mockSupabaseClient`, `mockPlaidHoldings`, `mockPolygonTrade`, `mockRateLimit`

## Open Questions

### Resolved During Planning

- **Q: Where do tests live?** A: Alongside source files: `src/lib/copy-trading/executor.test.ts`, `src/lib/sltp/monitor.test.ts`
- **Q: How to mock Supabase client?** A: `vi.mock("@/lib/supabase/server")` — the `getServiceClient` factory is the seam
- **Q: Do we need a test database?** A: No — pure unit tests with mocked dependencies. Integration tests with real DB are separate.

### Deferred to Implementation

- Exact mock factory signatures (will be discovered during implementation)
- Whether to use `describe.each` for parameterized cases (likely yes for trigger price points)

## Implementation Units

- [ ] **Unit 1: Set up Vitest configuration**

**Goal:** `npm test` runs Vitest with TypeScript support

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` — add `test` script, add `vitest` devDependency

**Approach:**
```typescript
// vitest.config.ts — directional guidance
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  plugins: [/* tsx or @vitejs/plugin-react if needed */],
  test: {
    environment: 'node', // not jsdom — no DOM APIs used in these files
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
```

**Patterns to follow:**
- Standard Vitest config conventions

**Verification:**
- `npm test` exits with code 0 (no tests yet, but no errors)
- `--coverage` flag works if configured

- [ ] **Unit 2: Create shared mock factories**

**Goal:** Reusable mocks for Supabase, Plaid, Polygon that all test files can import

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Create: `src/test-utils/index.ts` — exports all mock factories
- Create: `src/test-utils/mocks.ts` — individual mock implementations

**Mock factories (directional guidance):**
```typescript
// mockSupabaseClient(overrides) — returns a Supabase client stub
// mockPlaidHoldings({ holdings: [], securities: [] }) — returns HoldingsData
// mockPolygonTrade(price: number) — returns LastTrade response
// mockRateLimit(allowed: boolean) — returns RateLimitResult
```

**Patterns to follow:**
- Clear factory function names, typed return values, sensible defaults
- All factories accept partial overrides so tests can customize

**Verification:**
- `import { mockSupabaseClient, mockPlaidHoldings } from '@/test-utils'` resolves without error
- No TypeScript errors on import

- [ ] **Unit 3: Test executor.ts critical paths**

**Goal:** Cover the 5 highest-risk paths in `executeCopyTrade`

**Requirements:** R2

**Dependencies:** Unit 2

**Files:**
- Create: `src/lib/copy-trading/executor.test.ts`

**Test cases:**

| Case | Setup | Expected |
|------|-------|----------|
| Winner path | INSERT returns a row (UpsertResult with id) | Plaid called, row updated to `executed` |
| Loser path | INSERT returns null (duplicate key) | Existing row fetched, returned as success, Plaid NOT called |
| SELL no position | `holdings.find()` returns undefined | Row updated to `failed`, error = "No position found" |
| Plaid API failure | `postInvestmentOrder` throws | Row updated to `failed`, error_message set |
| Rate limited | `checkRateLimit` returns `allowed: false` | `{ success: false, error: "Rate limit exceeded" }` |

**Approach:**
- Use `vi.mock` to replace `getServiceClient`, `getInvestmentHoldings`, `postInvestmentOrder`, `checkRateLimit`
- Each test case creates a mock client with specific response data
- `vi.mock("@/lib/copy-trading/executor")` to test the exported function

**Execution note:** Implement domain behavior test-first — write the failing test case first, then the implementation.

**Patterns to follow:**
- `describe`/`it` pattern with descriptive strings
- One assertion per `it` block
- Use `beforeEach` to reset mocks

**Verification:**
- All 5 cases pass
- `npm test -- --run src/lib/copy-trading/executor.test.ts` exits 0

- [ ] **Unit 4: Test monitor.ts evaluate paths**

**Goal:** Cover the SL/TP/trailing trigger logic in `evaluateTrailingStop` and the market-closed skip in `runMonitorCycle`

**Requirements:** R3

**Dependencies:** Unit 2

**Files:**
- Create: `src/lib/sltp/monitor.test.ts`

**Test cases:**

| Case | Input | Expected |
|------|-------|----------|
| BUY SL triggered | entry=100, stop_loss=95, current=94 | `"sl"` |
| BUY TP triggered | entry=100, take_profit=110, current=111 | `"tp"` |
| BUY trailing triggered | entry=100, activate=5%, trailing=2%, trailingHigh=107, current=104.86 | `"trailing"` |
| BUY no trigger | entry=100, SL=95, TP=110, current=102 | `null` |
| SELL SL triggered | entry=100, stop_loss=105, current=106 | `"sl"` |
| SELL TP triggered | entry=100, take_profit=90, current=89 | `"tp"` |
| Market closed | `isMarketOpen()` returns false | `{ processed: 0, triggered: 0, errors: 0 }` |
| Orphaned monitor (position_id null) | LEFT JOIN returns monitor with null position | processed=1, triggered=0, no order placed |

**Note:** `evaluateTrailingStop` is a pure function — no mocking needed. Tests can call it directly.

**For `runMonitorCycle` market-closed case:** Mock `getServiceClient` to return empty monitors array AND mock `isMarketOpen()` to return false.

**Execution note:** `evaluateTrailingStop` is a pure function — test-first is natural here. Write the table-driven tests.

**Patterns to follow:**
- Table-driven test pattern for evaluateTrailingStop (many price combinations)
- `describe.each` for BUY/SELL symmetry cases

**Verification:**
- All 8 cases pass
- `npm test -- --run src/lib/sltp/monitor.test.ts` exits 0

## System-Wide Impact

- **Interaction graph:** Adding tests does not change any runtime behavior. No production code changes in Units 1-2; Units 3-4 test existing code without modifying it.
- **Error propagation:** Tests document expected error behavior — if actual code changes, tests will catch regressions.

## Risks & Dependencies

- **Risk:** The `vi.mock` calls may need to be refreshed if `executor.ts` or `monitor.ts` imports change. This is normal — maintain the tests when refactoring.
- **Risk:** `getServiceClient` is called at module initialization in `executor.ts`. `vi.mock` must be called before the module is imported. Use `vi.mock("@/lib/copy-trading/executor", ...)` with a factory that returns the mocked module.

## Documentation / Operational Notes

- Add `npm run test` to the project's CI pipeline once Unit 1 is complete
- Document the mock factory conventions in a comment at the top of `src/test-utils/index.ts`
- The first PR that adds a test file should include the pattern for future contributors

## Sources & References

- **Ideation:** [docs/ideation/2026-03-27-open-ideation.md](docs/ideation/2026-03-27-open-ideation.md)
- Related code: `src/lib/copy-trading/executor.ts`, `src/lib/sltp/monitor.ts`
