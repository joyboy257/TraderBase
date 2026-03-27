import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeCopyTrade } from "@/lib/copy-trading/executor";
import { CopyExecutionResult } from "@/types/copy-trading";

const HANDLER_TIMEOUT_MS = 30_000;

async function handleCopyTradeRequest(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Create server client and validate the token to get the user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse signalId from request body
    const body = await request.json();
    const { signalId } = body;

    if (!signalId || typeof signalId !== "string") {
      return NextResponse.json(
        { success: false, error: "signalId is required and must be a string" },
        { status: 400 }
      );
    }

    // Call executeCopyTrade with the authenticated user's ID and signal ID
    const result: CopyExecutionResult = await executeCopyTrade(userId, signalId);

    // Return the result with appropriate status code
    if (result.success) {
      return NextResponse.json({
        success: true,
        copied_trade_id: result.copied_trade_id,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        copied_trade_id: result.copied_trade_id,
      });
    }
  } catch (error) {
    console.error("[Copy Trading API] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const timeout = new Promise<NextResponse>((_, reject) =>
    setTimeout(() => reject(new Error("Handler timeout")), HANDLER_TIMEOUT_MS)
  );
  try {
    const response = await Promise.race([handleCopyTradeRequest(request), timeout]);
    return response;
  } catch (error) {
    console.error("[Copy Trading API] Request timeout or error:", error);
    return NextResponse.json(
      { success: false, error: "Request timeout" },
      { status: 504 }
    );
  }
}
