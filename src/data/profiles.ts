import type { Tables, TablesUpdate } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès aux données « profiles » : fonctions PURES (sans React) qui
// encapsulent les requêtes Supabase. Convention : elles LÈVENT en cas d'échec et
// renvoient la donnée directement — les appelants gèrent l'erreur via try/catch.
// Le typage vient des types générés (`Tables<...>`) -> zéro `as`.

// Colonnes LISIBLES du profil. EXCLUT volontairement device_location/search_location :
// le GPS n'est jamais renvoyé au client (pas de GRANT SELECT côté base). Ne JAMAIS
// faire `select("*")` sur profiles -> PostgREST tenterait de lire le GPS -> 42501.
const PROFILE_COLUMNS =
  "id, display_name, bio, gender, birth_date, avatar_path, city_id, onboarding_completed, created_at, updated_at";

// Le profil tel que le client le voit : la ligne générée MOINS les colonnes GPS.
export type Profile = Omit<Tables<"profiles">, "device_location" | "search_location">;

// Champs du profil éditables DIRECTEMENT par l'utilisateur (écran Edit profile).
// city_id et le GPS n'y sont pas : ils sont dérivés/écrits via la RPC set_my_location.
export type ProfileEdit = Pick<
  TablesUpdate<"profiles">,
  "display_name" | "bio" | "gender" | "birth_date" | "avatar_path"
>;

// Ville résolue par la RPC (jamais les coordonnées). cityId NULL = hors zone seedée.
export type ResolvedCity = { cityId: string | null; cityName: string | null };

// Récupère le profil d'un utilisateur. Renvoie `null` si la ligne n'existe pas
// encore (cas pré-onboarding, toléré par `maybeSingle`). Lève si la requête échoue.
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Met à jour les champs éditables du profil, renvoie la ligne à jour. La ligne
// existe TOUJOURS déjà (le trigger d'inscription la crée) -> update (pas upsert).
// ⚠ Ne PAS faire d'upsert ici : PostgREST mettrait `id` dans le `DO UPDATE SET`,
// or le GRANT UPDATE colonne n'accorde pas `id` -> 42501. C'est aussi par cette
// fonction que passe l'onboarding (champ display_name seul).
export async function updateProfile(
  userId: string,
  fields: ProfileEdit,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Écrit la position via la RPC `security definer` (construit la geography côté
// serveur, dérive city_id) et renvoie UNIQUEMENT la ville résolue — jamais les
// coordonnées. cityId/cityName peuvent être NULL si l'utilisateur est hors zone.
export async function setMyLocation(
  lat: number,
  lng: number,
): Promise<ResolvedCity> {
  const { data, error } = await supabase
    .rpc("set_my_location", { p_lat: lat, p_lng: lng })
    .single();
  if (error) throw error;
  // Le générateur type matched_* en non-null ; en réalité ils peuvent être NULL
  // (hors zone). On élargit honnêtement le type de retour à `| null`.
  return { cityId: data.matched_city_id, cityName: data.matched_city_name };
}
