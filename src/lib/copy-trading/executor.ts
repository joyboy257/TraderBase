import { createServerClient } from "@supabase/ssr";
import { CopyExecutionResult, CopiedTrade } from "@/types/copy-trading";

// Signal type from the database
interface Signal {
  id: string;
  user_id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
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
 * Execute a copy trade for a single follower based on a signal.
 *
 * Steps:
 * 1. Get the signal from database (user_id, ticker, action, entry_price)
 * 2. Get the follow relationship (copy_ratio, max_position_size, brokerage_connection_id)
 * 3. Get the brokerage connection (plaid_access_token_encrypted)
 * 4. Calculate quantity: qty = (copy_ratio * max_position_size) / entry_price
 * 5. Execute order via Plaid (MVP: record as pending, actual execution requires securities master)
 * 6. Record copied_trade in database
 * 7. Return result
 *
 * Edge cases:
 * - If copy_ratio is 0 or is_active is false: skip silently
 * - If no brokerage connected: return { success: false, error: 'No brokerage' }
 * - If qty <= 0: skip
 * - If Plaid API fails: record as 'failed' with error_message, return { success: false, error }
 */
export async function executeCopyTrade(followerId: string, signalId: string): Promise<CopyExecutionResult> {
  try {
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

    // Step 3: Get the brokerage connection
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
    // qty = (copy_ratio * max_position_size) / entry_price
    const entryPrice = Number(typedSignal.entry_price);
    if (entryPrice <= 0) {
      return { success: false, error: "Invalid entry price" };
    }

    const quantity = (typedFollow.copy_ratio * typedFollow.max_position_size) / entryPrice;

    // Skip if qty <= 0
    if (quantity <= 0) {
      return { success: false, error: "Calculated quantity is 0 or negative" };
    }

    // Round to 4 decimal places for stock quantities
    const roundedQuantity = Math.round(quantity * 10000) / 10000;

    // Step 5: Execute order via Plaid (MVP: stub - actual execution requires securities master)
    // TODO: Once Plaid SDK supports investmentsOrdersPost or we have a securities master,
    // implement actual brokerage execution here.
    // For now, we log a warning and mark as pending.
    console.warn(
      `[Copy Trading] MVP STUB: Would execute ${typedSignal.action} ${roundedQuantity} shares of ${typedSignal.ticker} ` +
      `for user ${followerId} at ~$${entryPrice}. ` +
      `Actual brokerage execution requires securities master lookup.`
    );

    // Step 6: Record copied_trade in database
    const copiedTrade: Omit<CopiedTrade, "id"> = {
      user_id: followerId,
      signal_id: signalId,
      brokerage_connection_id: typedBrokerage.id,
      ticker: typedSignal.ticker,
      action: typedSignal.action,
      quantity: roundedQuantity,
      price: entryPrice,
      executed_at: new Date().toISOString(),
      status: "pending", // MVP: marked as pending until actual execution
      error_message: "Awaiting securities master integration for actual execution",
    };

    const { data: insertedTrade, error: insertError } = await serviceClient
      .from("copied_trades")
      .insert(copiedTrade)
      .select("id")
      .single();

    if (insertError) {
      console.error("[Copy Trading] Failed to insert copied_trade:", insertError);
      return { success: false, error: "Failed to record copied trade" };
    }

    // Step 7: Return result
    return {
      success: true,
      copied_trade_id: insertedTrade.id,
    };

  } catch (error) {
    console.error("[Copy Trading] executeCopyTrade error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
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
