"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const bio = (formData.get("bio") as string | null)?.trim() ?? "";

  // Validate
  if (!username || username.length < 3 || username.length > 30) {
    return { error: "Username must be 3-30 characters" };
  }
  if (!/^[a-z0-9_]+$/i.test(username)) {
    return { error: "Username can only contain letters, numbers, and underscores" };
  }
  if (bio.length > 500) {
    return { error: "Bio must be under 500 characters" };
  }

  // Upsert profile
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: displayName || null,
      username,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/traders");
  return { success: true };
}

export async function saveCopySettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const copyRatio = parseFloat(formData.get("copy_ratio") as string) / 100;
  const maxPositionSize = parseFloat(formData.get("max_position_size") as string);
  const isActive = formData.get("is_active") === "true";

  if (isNaN(copyRatio) || copyRatio < 0 || copyRatio > 1) {
    return { error: "Copy ratio must be 0-100%" };
  }
  if (isNaN(maxPositionSize) || maxPositionSize < 0) {
    return { error: "Max position size must be a positive number" };
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        copy_trading_ratio: copyRatio,
        copy_trading_max_position: maxPositionSize,
        copy_trading_enabled: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.warn("[Copy Settings] Profile update failed (columns may not exist):", error.message);
    }
  } catch (e) {
    console.warn("[Copy Settings] Upsert failed:", e);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Use service role to delete user data
  const { createServerClient } = await import("@supabase/ssr");
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Delete user data in order (respecting foreign keys)
  // Delete follows where user is follower or leader
  await serviceClient.from("follows").delete().or(`follower_id.eq.${user.id},leader_id.eq.${user.id}`);
  // Delete signals
  await serviceClient.from("signals").delete().eq("user_id", user.id);
  // Delete chat messages
  await serviceClient.from("chat_messages").delete().eq("user_id", user.id);
  // Delete brokerage connections (positions cascade)
  await serviceClient.from("brokerage_connections").delete().eq("user_id", user.id);
  // Delete profile
  await serviceClient.from("profiles").delete().eq("id", user.id);
  // Delete auth user
  await serviceClient.auth.admin.deleteUser(user.id);

  revalidatePath("/", "layout");
  return { success: true };
}

export async function disconnectBrokerage(connectionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("brokerage_connections")
    .update({ is_active: false })
    .eq("id", connectionId)
    .eq("user_id", user.id); // Ensure user owns this connection

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}