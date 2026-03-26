import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const serviceClient = getServiceClient();

    // Soft-delete: set is_active = false
    const { error: updateError } = await serviceClient
      .from("brokerage_connections")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (updateError) {
      console.error("Failed to deactivate connection:", updateError);
      return NextResponse.json(
        { error: "Failed to disconnect brokerage" },
        { status: 500 }
      );
    }

    // Delete associated positions
    const { error: positionsError } = await serviceClient
      .from("positions")
      .delete()
      .eq("brokerage_connection_id", id)
      .eq("user_id", user.id);

    if (positionsError) {
      console.error("Failed to delete positions:", positionsError);
      // Non-fatal — connection is already deactivated
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("deleteConnection error:", error);
    const message = error instanceof Error ? error.message : "Failed to disconnect brokerage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
