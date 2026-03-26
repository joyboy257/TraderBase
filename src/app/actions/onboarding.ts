'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Mark onboarding as complete for a given path.
 * Called when user finishes the wizard (both trader and copier paths
 * complete at ConnectBrokerageStep per R4 and the plan).
 */
export async function finishOnboarding(path: "trader" | "copier") {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_complete: true,
        onboarding_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[Onboarding] finishOnboarding error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Advance to a specific wizard step.
 * Used by step components to persist step progress.
 */
export async function completeOnboardingStep(step: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_step: step,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[Onboarding] completeOnboardingStep error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
