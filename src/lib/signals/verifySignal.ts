import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface VerifySignalResult {
  success: boolean;
  verified: boolean;
  error?: string;
}

/**
 * Manually trigger signal verification for a given signal.
 * Uses the verify_signal_position_audit Postgres function.
 *
 * Idempotent: re-running updates verified_at to NOW() but doesn't create duplicates.
 *
 * @param signalId - The UUID of the signal to verify
 */
export async function verifySignal(signalId: string): Promise<VerifySignalResult> {
  try {
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("verify_signal_position_audit", {
      signal_id: signalId,
    });

    if (error) {
      console.error("[Signal Verification] verify_signal_position_audit error:", error);
      return { success: false, verified: false, error: error.message };
    }

    // The function returns TRUE if verified, FALSE otherwise
    return { success: true, verified: data === true };
  } catch (error) {
    console.error("[Signal Verification] verifySignal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, verified: false, error: message };
  }
}

/**
 * Batch verify multiple signals.
 * Runs verification concurrently using Promise.allSettled.
 *
 * @param signalIds - Array of signal UUIDs to verify
 */
export async function verifySignalsBatch(signalIds: string[]): Promise<VerifySignalResult[]> {
  const results = await Promise.allSettled(
    signalIds.map((id) => verifySignal(id))
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return { success: false, verified: false, error: String(result.reason) };
  });
}
