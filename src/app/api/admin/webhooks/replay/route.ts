import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const { webhookEventId } = await request.json();
  const serviceClient = getServiceClient();

  const { data: event } = await serviceClient
    .from("webhook_events")
    .select("*")
    .eq("id", webhookEventId)
    .eq("status", "failed")
    .single();

  if (!event) {
    return NextResponse.json(
      { error: "Event not found or not in DLQ" },
      { status: 404 }
    );
  }

  await serviceClient
    .from("webhook_events")
    .update({
      status: "pending",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", webhookEventId);

  return NextResponse.json({ replayed: true });
}
