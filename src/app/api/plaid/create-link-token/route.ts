import { createClient } from "@/lib/supabase/server";
import { createLinkToken } from "@/lib/plaid/client";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      return NextResponse.json(
        { error: "Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to .env.local" },
        { status: 503 }
      );
    }

    const { link_token } = await createLinkToken(user.id);

    return NextResponse.json({ link_token });
  } catch (error: unknown) {
    console.error("createLinkToken error:", error);
    const message = error instanceof Error ? error.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
