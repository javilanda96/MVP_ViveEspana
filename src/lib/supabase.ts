import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

// config.ts validates SUPABASE_URL and SUPABASE_SERVICE_KEY at startup
// via secrets.ts — no additional checks needed here.
export const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true });

    return !error;
  } catch {
    return false;
  }
}