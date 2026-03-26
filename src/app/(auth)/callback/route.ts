import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Validate next is a safe relative path (no domain takeover)
  const SAFE_PATHS = ["/dashboard", "/feed", "/signals", "/portfolio", "/settings", "/chat", "/traders"];
  const isSafeNext = SAFE_PATHS.some((p) => next === p || next.startsWith(p + "/"));
  const safeRedirect = isSafeNext ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeRedirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
