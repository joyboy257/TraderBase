'use server';

import { createClient } from "@/lib/supabase/server";
import { getTopTraders } from "@/lib/traders";

/**
 * Server action wrapper for getTopTraders.
 * browseTraders.tsx calls this on mount.
 */
export async function fetchTopTraders(limit = 10) {
  return getTopTraders(limit);
}
