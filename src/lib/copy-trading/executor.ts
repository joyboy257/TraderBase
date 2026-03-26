import { createServerClient } from "@supabase/ssr";
import { CopyExecutionResult, CopiedTrade } from "@/types/copy-trading";
import { getInvestmentHoldings, postInvestmentOrder } from "@/lib/plaid/client";
import { decrypt } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

// Signal type from the database
interface Signal {
  id: string;
  user_id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  is_active: boolean;
}

// Follow type from the database
interface Follow {
  id: string;
  follower_id: string;
  leader_id: string;
  copy_ratio: number;
  max_position_size: number;
  is_active: boolean;
}

// Brokerage connection type from the database
interface BrokerageConnection {
  id: string;
  user_id: string;
  plaid_access_token_encrypted: string;
  account_id: string;
}

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Derive the 3-part idempotency key for a copy trade.
 * Format: signal_id:follower_id:brokerage_connection_id
 */
function deriveIdempotencyKey(
  signalId: string,
  followerId: string,
  brokerageConnectionId: string
): string {
  return `${signalId}:${followerId}:${brokerageConnectionId}`;
}

/**
 * Execute a copy trade for a single follower based on a signal.
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING RETURNING for atomic idempotency:
 * - Winner (row returned): calls Plaid, then UPDATEs the row with result
 * - Loser (no row returned): fetches existing row, returns as success without calling Plaid
 *
 * Steps:
 * 1. Rate limit check
 * 2. Get the signal from database
 * 3. Get the follow relationship (copy_ratio, max_position_size)
 * 4. Get the brokerage connection (plaid_access_token_encrypted)
 * 5. Derive idempotency key (signal_id:follower_id:brokerage_connection_id)
 * 6. Atomic INSERT ... ON CONFLICT DO NOTHING RETURNING
 * 7. Winner: validate, call Plaid, UPDATE row with result
 * 8. Loser: fetch existing row, return success (skip Plaid)
 *
 * Edge cases:
 * - If copy_ratio is 0 or is_active is false: skip silently
 * - If no brokerage connected: return { success: false, error: 'No brokerage' }
 * - If qty <= 0: skip
 * - If Plaid API fails: record as 'failed' with error_message, return { success: false, error }
 * - Concurrent calls: only one calls Plaid (winner), loser returns existing row
 */
export async function executeCopyTrade(followerId: string, signalId: string): Promise<CopyExecutionResult> {
  try {
    // Rate limit check — prevent spam/abuse
    const { allowed, remaining } = checkRateLimit(followerId);
    if (!allowed) {
      console.warn(`[Copy Trading] Rate limit exceeded for user ${followerId}`);
      return { success: false, error: "Rate limit exceeded. Please try again later." };
    }

    const serviceClient = getServiceClient();

    // Step 1: Get the signal
    const { data: signal, error: signalError } = await serviceClient
      .from("signals")
      .select("*")
      .eq("id", signalId)
      .eq("is_active", true)
      .single();

    if (signalError || !signal) {
      return { success: false, error: "Signal not found or inactive" };
    }

    const typedSignal = signal as Signal;

    // Step 2: Get the follow relationship
    const { data: follow, error: followError } = await serviceClient
      .from("follows")
      .select("*")
      .eq("follower_id", followerId)
      .eq("leader_id", typedSignal.user_id)
      .eq("is_active", true)
      .single();

    if (followError || !follow) {
      return { success: false, error: "No active follow relationship found" };
    }

    const typedFollow = follow as Follow;

    // Skip if copy_ratio is 0
    if (typedFollow.copy_ratio <= 0) {
      return { success: false, error: "Copy ratio is 0" };
    }

    // Step 3: Get the brokerage connection (MUST be before idempotency check for key derivation)
    const { data: brokerage, error: brokerageError } = await serviceClient
      .from("brokerage_connections")
      .select("*")
      .eq("user_id", followerId)
      .eq("is_active", true)
      .single();

    if (brokerageError || !brokerage) {
      return { success: false, error: "No active brokerage connection" };
    }

    const typedBrokerage = brokerage as BrokerageConnection;

    // Step 4: Calculate quantity
    const entryPrice = Number(typedSignal.entry_price);
    if (entryPrice <= 0) {
      return { success: false, error: "Invalid entry price" };
    }

    const quantity = (typedFollow.copy_ratio * typedFollow.max_position_size) / entryPrice;
    if (quantity <= 0) {
      return { success: false, error: "Calculated quantity is 0 or negative" };
    }

    const roundedQuantity = Math.round(quantity * 10000) / 10000;

    // Step 5: Derive idempotency key BEFORE the atomic insert
    const idempotencyKey = deriveIdempotencyKey(signalId, followerId, typedBrokerage.id);

    // Step 6: Atomic INSERT ... ON CONFLICT DO NOTHING RETURNING
    // Winner: gets a row back, proceeds to call Plaid
    // Loser: gets null (duplicate key), should not call Plaid
    const { data: insertResult, error: insertError } = await serviceClient
      .from("copied_trades")
      .upsert(
        {
          idempotency_key: idempotencyKey,
          user_id: followerId,
          signal_id: signalId,
          brokerage_connection_id: typedBrokerage.id,
          ticker: typedSignal.ticker,
          action: typedSignal.action,
          quantity: roundedQuantity,
          price: entryPrice,
          executed_at: new Date().toISOString(),
          status: "pending",
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true }
      )
      .select("id, status")
      .single();

    // Loser path: no row returned from RETURNING, another request won the race
    if (!insertResult) {
      const { data: existingRow } = await serviceClient
        .from("copied_trades")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existingRow) {
        // Treat pending as "in flight" success
        return { success: true, copied_trade_id: existingRow.id };
      }
      // Edge case: row somehow gone, but we didn't insert - treat as conflict and fail
      return { success: false, error: "Concurrent execution conflict" };
    }

    // Winner path: we got a row back, proceed to call Plaid
    const tradeRowId = insertResult.id;

    // Step 7: Winner calls Plaid - first validate holdings for SELL
    const accessToken = typedBrokerage.plaid_access_token_encrypted.includes(":")
      ? decrypt(typedBrokerage.plaid_access_token_encrypted)
      : typedBrokerage.plaid_access_token_encrypted;

    // Look up investment holdings
    const holdingsData = await getInvestmentHoldings(accessToken);
    const { holdings, securities } = holdingsData;

    // Find the security matching the signal ticker
    const security = securities.find((s) => s.ticker_symbol === typedSignal.ticker);

    // For SELL, we need to know the current held quantity
    let orderQuantity = roundedQuantity;
    if (typedSignal.action === "SELL") {
      const holding = holdings.find((h) => h.security_id === security?.security_id);
      if (!holding || holding.quantity <= 0) {
        // No position to sell — record as failed and return
        await serviceClient
          .from("copied_trades")
          .update({
            status: "failed",
            error_message: `No position found for ${typedSignal.ticker}`,
            executed_at: new Date().toISOString(),
          })
          .eq("id", tradeRowId);

        return {
          success: false,
          copied_trade_id: tradeRowId,
          error: `No position found for ${typedSignal.ticker}`,
        };
      }
      orderQuantity = holding.quantity;
    }

    if (!security) {
      const errorMsg = `Security ${typedSignal.ticker} not found in holdings`;
      await serviceClient
        .from("copied_trades")
        .update({
          status: "failed",
          error_message: errorMsg,
          executed_at: new Date().toISOString(),
        })
        .eq("id", tradeRowId);

      return { success: false, copied_trade_id: tradeRowId, error: errorMsg };
    }

    // Place the order via Plaid
    let orderSuccess = false;
    let orderErrorMessage: string | undefined;

    try {
      await postInvestmentOrder(accessToken, typedBrokerage.account_id, [
        {
          security_id: security.security_id,
          quantity: orderQuantity,
          type: "market",
          side: typedSignal.action === "BUY" ? "BUY" : "SELL",
        },
      ]);
      orderSuccess = true;
    } catch (err) {
      orderErrorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Copy Trading] Plaid order failed:`, orderErrorMessage);
    }

    // Step 8: UPDATE the row with Plaid result
    const { data: updatedTrade } = await serviceClient
      .from("copied_trades")
      .update({
        status: orderSuccess ? "executed" : "failed",
        error_message: orderErrorMessage,
        executed_at: new Date().toISOString(),
      })
      .eq("id", tradeRowId)
      .select("id")
      .single();

    // Insert sltp_monitors row if the signal has stop_loss or take_profit
    if (orderSuccess && updatedTrade && (typedSignal.stop_loss != null || typedSignal.take_profit != null)) {
      await serviceClient.from("sltp_monitors").insert({
        user_id: followerId,
        position_id: null, // linked when positions webhook fires
        copied_trade_id: updatedTrade.id,
        signal_id: signalId,
        brokerage_connection_id: typedBrokerage.id,
        ticker: typedSignal.ticker,
        action: typedSignal.action,
        stop_loss: typedSignal.stop_loss ?? null,
        take_profit: typedSignal.take_profit ?? null,
        entry_price: entryPrice,
        status: "active",
      });
    }

    // Step 9: Return result
    return orderSuccess
      ? { success: true, copied_trade_id: updatedTrade?.id ?? tradeRowId }
      : { success: false, copied_trade_id: tradeRowId, error: orderErrorMessage };

  } catch (error) {
    console.error("[Copy Trading] executeCopyTrade error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Retry a failed copy trade by deleting the failed row and re-executing.
 *
 * This allows users to retry a trade that previously failed due to a transient
 * error (e.g., network timeout, Plaid API error).
 *
 * @param copiedTradeId - The ID of the failed copied_trades row
 * @param options - Optional parameters
 * @param options.forcePending - If true, retry even if the trade is still 'pending'
 */
export async function retryCopyTrade(
  copiedTradeId: string,
  options?: { forcePending?: boolean }
): Promise<CopyExecutionResult> {
  const serviceClient = getServiceClient();

  const { data: failedTrade, error: fetchError } = await serviceClient
    .from("copied_trades")
    .select("*")
    .eq("id", copiedTradeId)
    .single();

  if (fetchError || !failedTrade) {
    return { success: false, error: "Failed trade not found" };
  }

  if (failedTrade.status === "pending" && !options?.forcePending) {
    return { success: false, error: "Trade is pending. Use forcePending to override." };
  }

  // Delete the failed/pending row so a new one can be created
  const { error: deleteError } = await serviceClient
    .from("copied_trades")
    .delete()
    .eq("id", copiedTradeId);

  if (deleteError) {
    return { success: false, error: "Failed to delete failed trade row" };
  }

  // Re-execute the copy trade
  return executeCopyTrade(failedTrade.user_id, failedTrade.signal_id);
}

/**
 * Process copy trades for all followers of a signal's creator.
 * For each follower with is_active=true and copy_ratio > 0:
 *   await executeCopyTrade(follower.id, signalId)
 * Run concurrently with Promise.allSettled (don't fail whole batch on one error)
 */
export async function processAllFollowers(signalId: string): Promise<void> {
  try {
    const serviceClient = getServiceClient();

    // Get the signal first to find the leader
    const { data: signal, error: signalError } = await serviceClient
      .from("signals")
      .select("user_id")
      .eq("id", signalId)
      .eq("is_active", true)
      .single();

    if (signalError || !signal) {
      console.error("[Copy Trading] processAllFollowers: Signal not found:", signalId);
      return;
    }

    const typedSignal = signal as Signal;

    // Rate limit check at the leader level — prevent signal spam from triggering follower cascade
    const { allowed } = checkRateLimit(typedSignal.user_id);
    if (!allowed) {
      console.warn(`[Copy Trading] Rate limit exceeded for leader ${typedSignal.user_id}, skipping follower processing`);
      return;
    }

    // Get all active followers of this leader with copy_ratio > 0
    const { data: followers, error: followersError } = await serviceClient
      .from("follows")
      .select("id, follower_id, copy_ratio, max_position_size, is_active")
      .eq("leader_id", typedSignal.user_id)
      .eq("is_active", true)
      .gt("copy_ratio", 0);

    if (followersError || !followers) {
      console.error("[Copy Trading] processAllFollowers: Failed to get followers:", followersError);
      return;
    }

    if (followers.length === 0) {
      console.log(`[Copy Trading] No active followers to process for signal ${signalId}`);
      return;
    }

    console.log(`[Copy Trading] Processing ${followers.length} followers for signal ${signalId}`);

    // Execute copy trades concurrently with Promise.allSettled
    const results = await Promise.allSettled(
      followers.map((follow) => executeCopyTrade(follow.follower_id, signalId))
    );

    // Log results
    const successes = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failures = results.length - successes;

    console.log(
      `[Copy Trading] Completed: ${successes} succeeded, ${failures} failed for signal ${signalId}`
    );

    // Log any individual failures at error level
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[Copy Trading] Follower ${followers[index].follower_id} rejected:`, result.reason);
      } else if (!result.value.success) {
        console.error(
          `[Copy Trading] Follower ${followers[index].follower_id} failed:`,
          result.value.error
        );
      }
    });

  } catch (error) {
    console.error("[Copy Trading] processAllFollowers error:", error);
  }
}
