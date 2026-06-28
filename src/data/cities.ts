import type { Tables } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « cities » (référentiel seedé, lecture seule). On ne sélectionne
// JAMAIS `center` (geography) : illisible côté client (EWKB) et inutile à l'UI.

// On exclut center (geography illisible) + created_at + timezone (usage serveur only).
export type City = Omit<Tables<"cities">, "center" | "created_at" | "timezone">;

const CITY_COLUMNS = "id, name, slug, country_code";

// Récupère une ville par id (ex. afficher la ville du profil). NULL si absente.
export async function fetchCity(cityId: string): Promise<City | null> {
  const { data, error } = await supabase
    .from("cities")
    .select(CITY_COLUMNS)
    .eq("id", cityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
