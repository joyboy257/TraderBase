import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leader_id } = await request.json();
  if (!leader_id) return NextResponse.json({ error: "leader_id required" }, { status: 400 });
  if (!UUID_REGEX.test(leader_id)) {
    return NextResponse.json({ error: "Invalid leader_id format" }, { status: 400 });
  }
  if (leader_id === user.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const { data: leaderProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", leader_id)
    .single();

  if (!leaderProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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
    try {
      const { error: insertError } = await supabase.from("follows").insert({
        follower_id: user.id,
        leader_id: leader_id,
        copy_ratio: 0.5,
        max_position_size: 500,
        is_active: true,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          // Already following - reactivate if needed (best effort, ignore error)
          await supabase
            .from("follows")
            .update({ is_active: true })
            .eq("follower_id", user.id)
            .eq("leader_id", leader_id);
        } else {
          console.error("Follow insert error:", insertError);
          return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
        }
      }
    } catch (err) {
      console.error("Follow insert error:", err);
      return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leader_id } = await request.json();
  if (!leader_id) return NextResponse.json({ error: "leader_id required" }, { status: 400 });
  if (!UUID_REGEX.test(leader_id)) {
    return NextResponse.json({ error: "Invalid leader_id format" }, { status: 400 });
  }
  if (leader_id === user.id) {
    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  }

  const { data: leaderProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", leader_id)
    .single();

  if (!leaderProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await supabase
    .from("follows")
    .update({ is_active: false })
    .eq("follower_id", user.id)
    .eq("leader_id", leader_id);

  return NextResponse.json({ success: true });
}
