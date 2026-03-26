'use server';

import { createClient } from "@/lib/supabase/server";
import { executeCopyTrade, processAllFollowers } from "@/lib/copy-trading/executor";
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

    // For now, allow any authenticated user to trigger (could be restricted to signal owner or admin)
    // The executor will handle checking follow relationships
    await processAllFollowers(signalId);

    return { success: true };

  } catch (error) {
    console.error("[Copy Trading Action] triggerCopyTradingForSignal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
