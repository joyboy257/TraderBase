'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getLastTrade } from "@/lib/polygon/client";

/**
 * Create a new trading signal.
 * entry_price is optional — falls back to current market price when not provided (per R26).
 */
export async function createSignal(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const ticker = (formData.get("ticker") as string | null)?.trim().toUpperCase();
    const action = (formData.get("action") as string | null)?.trim().toUpperCase();
    const entryPriceRaw = (formData.get("entry_price") as string | null)?.trim();
    const stopLossRaw = (formData.get("stop_loss") as string | null)?.trim();
    const takeProfitRaw = (formData.get("take_profit") as string | null)?.trim();
    const rationale = (formData.get("rationale") as string | null)?.trim() ?? "";

    // Validate ticker
    if (!ticker || ticker.length === 0) {
      return { success: false, error: "Ticker is required" };
    }
    if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) {
      return { success: false, error: "Invalid ticker symbol" };
    }

    // Validate action
    if (!action || !["BUY", "SELL"].includes(action)) {
      return { success: false, error: "Action must be BUY or SELL" };
    }

    // Validate rationale length
    if (rationale.length > 1000) {
      return { success: false, error: "Rationale must be under 1000 characters" };
    }

    // Resolve entry_price: use provided value or fetch current market price
    let entryPrice: number | null = null;
    if (entryPriceRaw && entryPriceRaw.length > 0) {
      entryPrice = parseFloat(entryPriceRaw);
      if (isNaN(entryPrice) || entryPrice <= 0) {
        return { success: false, error: "Entry price must be a positive number" };
      }
    } else {
      // Fallback to current market price (per R26)
      try {
        const trade = await getLastTrade(ticker);
        entryPrice = trade.price;
      } catch {
        return { success: false, error: `Could not fetch current price for ${ticker}. Please provide an entry price.` };
      }
    }

    // Validate stop_loss
    let stopLoss: number | null = null;
    if (stopLossRaw && stopLossRaw.length > 0) {
      stopLoss = parseFloat(stopLossRaw);
      if (isNaN(stopLoss) || stopLoss <= 0) {
        return { success: false, error: "Stop loss must be a positive number" };
      }
    }

    // Validate take_profit
    let takeProfit: number | null = null;
    if (takeProfitRaw && takeProfitRaw.length > 0) {
      takeProfit = parseFloat(takeProfitRaw);
      if (isNaN(takeProfit) || takeProfit <= 0) {
        return { success: false, error: "Take profit must be a positive number" };
      }
    }

    // Insert signal
    const { data: inserted, error: insertError } = await supabase
      .from("signals")
      .insert({
        user_id: user.id,
        ticker,
        action,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        rationale: rationale || null,
        is_active: true,
        is_verified: false,
      })
      .select("id")
      .single();

    if (insertError) return { success: false, error: insertError.message };
    if (!inserted) return { success: false, error: "Failed to create signal" };

    revalidatePath("/signals");
    revalidatePath("/dashboard");
    return { success: true, signal_id: inserted.id };
  } catch (error) {
    console.error("[Signals] createSignal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
