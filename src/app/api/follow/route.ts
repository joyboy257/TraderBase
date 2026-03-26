import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leader_id } = await request.json();
  if (!leader_id) return NextResponse.json({ error: "leader_id required" }, { status: 400 });
  if (leader_id === user.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  // Check if already exists
  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("leader_id", leader_id)
    .single();

  if (existing) {
    // Already following — reactivate if inactive
    await supabase.from("follows").update({ is_active: true }).eq("id", existing.id);
  } else {
    await supabase.from("follows").insert({
      follower_id: user.id,
      leader_id: leader_id,
      copy_ratio: 0.5,
      max_position_size: 500,
      is_active: true,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leader_id } = await request.json();
  if (!leader_id) return NextResponse.json({ error: "leader_id required" }, { status: 400 });

  await supabase
    .from("follows")
    .update({ is_active: false })
    .eq("follower_id", user.id)
    .eq("leader_id", leader_id);

  return NextResponse.json({ success: true });
}
