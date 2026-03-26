'use server';

import { createClient } from "@/lib/supabase/server";
import { executeCopyTrade, processAllFollowers, retryCopyTrade } from "@/lib/copy-trading/executor";
import { CopyExecutionResult } from "@/types/copy-trading";

/**
 * Server action wrapper for executeCopyTrade with auth check.
 * Only authenticated users can trigger copy trades.
 */
export async function triggerCopyTrade(followerId: string, signalId: string): Promise<CopyExecutionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify the followerId matches the authenticated user
    if (user.id !== followerId) {
      return { success: false, error: "Forbidden: Cannot trigger copy trade for another user" };
    }

    // --- Copy barrier: copier must have brokerage linked (R28, R29) ---
    // Fetch the follower's onboarding state
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete, onboarding_path")
      .eq("id", followerId)
      .single();

    if (profile?.onboarding_complete && profile.onboarding_path === "copier") {
      // Copier — verify they have an active brokerage connection
      const { data: brokerage } = await supabase
        .from("brokerage_connections")
        .select("id")
        .eq("user_id", followerId)
        .eq("is_active", true)
        .single();

      if (!brokerage) {
        return { success: false, error: "NO_BROKERAGE" };
      }
    }

    return await executeCopyTrade(followerId, signalId);

  } catch (error) {
    console.error("[Copy Trading Action] triggerCopyTrade error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Server action wrapper for processAllFollowers with auth check.
 * This is typically called when a signal is created to notify all followers.
 * Only the signal creator or system can trigger this.
 */
export async function triggerCopyTradingForSignal(signalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify the signal belongs to the authenticated user or they have permission
    const { data: signal } = await supabase
      .from("signals")
      .select("user_id")
      .eq("id", signalId)
      .single();

    if (!signal) {
      return { success: false, error: "Signal not found" };
    }

    // Only the signal creator or admin can trigger copy trading for a signal
    if (user.id !== signal.user_id) {
      return { success: false, error: "Forbidden: only the signal creator can trigger copy trading" };
    }

    await processAllFollowers(signalId);

    return { success: true };

  } catch (error) {
    console.error("[Copy Trading Action] triggerCopyTradingForSignal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Server action wrapper for retryCopyTrade with auth check.
 * Allows users to retry a previously failed copy trade.
 */
export async function retryCopyTradeAction(copiedTradeId: string): Promise<CopyExecutionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Fetch the copied_trade to verify ownership
    const { data: copiedTrade } = await supabase
      .from("copied_trades")
      .select("user_id")
      .eq("id", copiedTradeId)
      .single();

    if (!copiedTrade) {
      return { success: false, error: "Copied trade not found" };
    }

    // Only the owner can retry their own copy trade
    if (user.id !== copiedTrade.user_id) {
      return { success: false, error: "Forbidden: Cannot retry another user's copy trade" };
    }

    return await retryCopyTrade(copiedTradeId);

  } catch (error) {
    console.error("[Copy Trading Action] retryCopyTradeAction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
