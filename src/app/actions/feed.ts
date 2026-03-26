"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleLike(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    if (error) return { success: false, error: error.message };
    return { success: true, liked: false };
  } else {
    const { error } = await supabase.from("likes").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id" });
    if (error) return { success: false, error: error.message };
    return { success: true, liked: true };
  }
}

export async function addComment(postId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  if (!content || content.trim().length === 0) return { success: false, error: "Comment cannot be empty" };
  if (content.trim().length > 1000) return { success: false, error: "Comment must be under 1000 characters" };

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({ user_id: user.id, post_id: postId, content: content.trim() })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/feed");
  return { success: true, commentId: inserted.id };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/feed");
  return { success: true };
}
