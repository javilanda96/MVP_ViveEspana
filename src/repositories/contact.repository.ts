import { supabase } from "../lib/supabase.js";
import type { Contact, ContactInput } from "../types/models.js";

/**
 * Upsert a contact record.
 *
 * Conflict resolution (requiere UNIQUE constraint en la BD):
 *   - email presente  → onConflict: "email"
 *   - solo phone      → onConflict: "phone"
 *
 * La lógica de qué campo usar ya fue decidida en el service;
 * aquí solo ejecutamos la operación de BD.
 */
export async function upsertContact(
  data: ContactInput,
  onConflict: "email" | "phone"
): Promise<Contact> {
  const { data: result, error } = await supabase
    .from("contacts")
    .upsert(data, { onConflict, ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    throw new Error(`DB upsert failed: ${error.message}`);
  }

  return result as Contact;
}
