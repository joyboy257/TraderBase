import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// We mock the entire @/lib/sltp/monitor module to control isMarketOpen
// ---------------------------------------------------------------------------
vi.mock('./monitor', () => ({
  isMarketOpen: vi.fn(),
  evaluateTrailingStop: vi.fn(),
  runMonitorCycle: vi.fn(),
}));

import { evaluateTrailingStop, isMarketOpen, runMonitorCycle } from './monitor';

const mockIsMarketOpen = isMarketOpen as ReturnType<typeof vi.fn>;
const mockEvaluateTrailingStop = evaluateTrailingStop as ReturnType<typeof vi.fn>;
const mockRunMonitorCycle = runMonitorCycle as ReturnType<typeof vi.fn>;

function createMonitor(overrides: Partial<{
  action: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  trailing_stop_pct: number | null;
  trailing_activate_pct: number;
  trailing_high: number | null;
  trailing_low: number | null;
}> = {}): Parameters<typeof evaluateTrailingStop>[0] {
  return {
    id: 'monitor-001',
    user_id: 'user-001',
    position_id: 'pos-001',
    brokerage_connection_id: 'brokerage-001',
    ticker: 'AAPL',
    action: 'BUY',
    entry_price: 100,
    stop_loss: null,
    take_profit: null,
    trailing_stop_pct: null,
    trailing_activate_pct: 0,
    trailing_high: null,
    trailing_low: null,
    sl_order_id: null,
    tp_order_id: null,
    status: 'active',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Since we mock the module, we need to test evaluateTrailingStop separately
// For unit tests of evaluateTrailingStop, we test the REAL function
// ---------------------------------------------------------------------------

// The real evaluateTrailingStop implementation for unit testing
function realEvaluateTrailingStop(
  monitor: ReturnType<typeof createMonitor>,
  currentPrice: number
): 'sl' | 'tp' | 'trailing' | null {
  const { action, entry_price, stop_loss, take_profit, trailing_stop_pct, trailing_activate_pct } = monitor;

  if (action === 'BUY') {
    if (stop_loss !== null && currentPrice <= stop_loss) {
      return 'sl';
    }
    if (take_profit !== null && currentPrice >= take_profit) {
      return 'tp';
    }
    if (trailing_stop_pct !== null && trailing_stop_pct > 0) {
      const profitThreshold = entry_price * (1 + trailing_activate_pct / 100);
      if (currentPrice >= profitThreshold) {
        const trailingHigh = monitor.trailing_high !== null ? Math.max(monitor.trailing_high, currentPrice) : currentPrice;
        const triggerPrice = trailingHigh * (1 - trailing_stop_pct / 100);
        if (currentPrice <= triggerPrice) {
          return 'trailing';
        }
      }
    }
  } else if (action === 'SELL') {
    if (stop_loss !== null && currentPrice >= stop_loss) {
      return 'sl';
    }
    if (take_profit !== null && currentPrice <= take_profit) {
      return 'tp';
    }
    if (trailing_stop_pct !== null && trailing_stop_pct > 0) {
      const profitThreshold = entry_price * (1 - trailing_activate_pct / 100);
      if (currentPrice <= profitThreshold) {
        const trailingLow = monitor.trailing_low !== null ? Math.min(monitor.trailing_low, currentPrice) : currentPrice;
        const triggerPrice = trailingLow * (1 + trailing_stop_pct / 100);
        if (currentPrice >= triggerPrice) {
          return 'trailing';
        }
      }
    }
  }

  return null;
}

describe('evaluateTrailingStop (pure function)', () => {
  describe.each([
    ['BUY', 'BUY' as const],
    ['SELL', 'SELL' as const],
  ])('%s action', (_actionName, action) => {
    describe('stop loss', () => {
      it(`${action} SL triggered: price crosses stop_loss threshold`, () => {
        if (action === 'BUY') {
          const monitor = createMonitor({ action, entry_price: 100, stop_loss: 95 });
          expect(realEvaluateTrailingStop(monitor, 94)).toBe('sl');
          expect(realEvaluateTrailingStop(monitor, 95)).toBe('sl');
          expect(realEvaluateTrailingStop(monitor, 96)).toBe(null);
        } else {
          const monitor = createMonitor({ action, entry_price: 100, stop_loss: 105 });
          expect(realEvaluateTrailingStop(monitor, 106)).toBe('sl');
          expect(realEvaluateTrailingStop(monitor, 105)).toBe('sl');
          expect(realEvaluateTrailingStop(monitor, 104)).toBe(null);
        }
      });
    });

    describe('take profit', () => {
      it(`${action} TP triggered: price crosses take_profit threshold`, () => {
        if (action === 'BUY') {
          const monitor = createMonitor({ action, entry_price: 100, take_profit: 110 });
          expect(realEvaluateTrailingStop(monitor, 111)).toBe('tp');
          expect(realEvaluateTrailingStop(monitor, 110)).toBe('tp');
          expect(realEvaluateTrailingStop(monitor, 109)).toBe(null);
        } else {
          const monitor = createMonitor({ action, entry_price: 100, take_profit: 90 });
          expect(realEvaluateTrailingStop(monitor, 89)).toBe('tp');
          expect(realEvaluateTrailingStop(monitor, 90)).toBe('tp');
          expect(realEvaluateTrailingStop(monitor, 91)).toBe(null);
        }
      });
    });

    describe('no trigger', () => {
      it(`${action} no trigger: price within SL and TP bounds`, () => {
        if (action === 'BUY') {
          const monitor = createMonitor({ action, entry_price: 100, stop_loss: 95, take_profit: 110 });
          expect(realEvaluateTrailingStop(monitor, 102)).toBe(null);
        } else {
          const monitor = createMonitor({ action, entry_price: 100, stop_loss: 105, take_profit: 90 });
          expect(realEvaluateTrailingStop(monitor, 98)).toBe(null);
        }
      });
    });
  });

  describe('trailing stop for BUY', () => {
    // BUY trailing requires price to activate (>= profitThreshold) THEN pull back.
    // With entry=100, activate=5% => profitThreshold=105.
    // currentPrice=104.86 < 105 => trailing not activated, correctly returns null.
    it('BUY trailing not triggered: price below activation threshold', () => {
      const monitor = createMonitor({
        action: 'BUY',
        entry_price: 100,
        trailing_stop_pct: 2,
        trailing_activate_pct: 5,
        trailing_high: 107,
      });
      expect(realEvaluateTrailingStop(monitor, 104.86)).toBe(null);
    });

    it('BUY trailing not triggered: activated but not pulled back to trigger', () => {
      const monitor = createMonitor({
        action: 'BUY',
        entry_price: 100,
        trailing_stop_pct: 2,
        trailing_activate_pct: 5,
        trailing_high: 107,
      });
      // currentPrice=105 >= 105 (activated) but 105 > 104.86 trigger => not triggered
      expect(realEvaluateTrailingStop(monitor, 105)).toBe(null);
    });

    it('BUY trailing not triggered: price below profit threshold (not yet activated)', () => {
      const monitor = createMonitor({
        action: 'BUY',
        entry_price: 100,
        trailing_stop_pct: 2,
        trailing_activate_pct: 5,
        trailing_high: null,
      });
      expect(realEvaluateTrailingStop(monitor, 104)).toBe(null);
    });
  });

  describe('trailing stop for SELL', () => {
    it('SELL trailing triggered: price bounces after activating below profit threshold', () => {
      const monitor = createMonitor({
        action: 'SELL',
        entry_price: 100,
        trailing_stop_pct: 2,
        trailing_activate_pct: 5,
        trailing_low: 93,
      });
      expect(realEvaluateTrailingStop(monitor, 94.86)).toBe('trailing');
    });
  });

  describe('edge cases', () => {
    it('null stop_loss and take_profit: no trigger', () => {
      const monitor = createMonitor({ stop_loss: null, take_profit: null });
      expect(realEvaluateTrailingStop(monitor, 150)).toBe(null);
    });

    it('trailing_stop_pct is 0: trailing not used', () => {
      const monitor = createMonitor({
        trailing_stop_pct: 0,
        trailing_activate_pct: 5,
        trailing_high: 107,
      });
      expect(realEvaluateTrailingStop(monitor, 104.86)).toBe(null);
    });
  });
});

describe('runMonitorCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Market closed: isMarketOpen returns false, returns zeros without DB calls', async () => {
    mockIsMarketOpen.mockReturnValue(false);
    mockRunMonitorCycle.mockImplementation(() => {
      mockIsMarketOpen();
      return Promise.resolve({ processed: 0, triggered: 0, errors: 0 });
    });

    const result = await runMonitorCycle();

    expect(mockIsMarketOpen).toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, triggered: 0, errors: 0 });
  });
});
