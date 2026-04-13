import { supabase } from "../lib/supabase.js";
import type { Contact, ContactInput } from "../types/models.js";

/**
 * Look up a contact by email.
 *
 * Returns null (not throws) when no contact is found.
 */
export async function findContactByEmail(
  email: string
): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`DB lookup failed: ${error.message}`);
  }

  return data as Contact | null;
}

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
