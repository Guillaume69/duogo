import type { Tables, TablesUpdate } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès aux données « profiles » : fonctions PURES (sans React) qui
// encapsulent les requêtes Supabase. Convention : elles LÈVENT en cas d'échec et
// renvoient la donnée directement — les appelants gèrent l'erreur via try/catch.
// Le typage vient des types générés (`Tables<...>`) -> zéro `as`.

// Le profil tel que le client le voit : la ligne générée MOINS le GPS (jamais
// renvoyé au client). On le lit via la RPC `get_my_profile` (cf. fetchProfile) :
// depuis la brique 3, birth_date n'est plus lisible en direct par PostgREST (fuite
// de date de naissance), seul son propriétaire la relit via cette RPC.
export type Profile = Omit<Tables<"profiles">, "device_location">;

// Champs du profil éditables DIRECTEMENT par l'utilisateur (écran Edit profile).
// city_id et le GPS n'y sont pas : ils sont dérivés/écrits via la RPC set_my_location.
export type ProfileEdit = Pick<
  TablesUpdate<"profiles">,
  "display_name" | "bio" | "gender" | "birth_date" | "avatar_path"
>;

// Ville résolue par la RPC (jamais les coordonnées). cityId NULL = hors zone seedée.
export type ResolvedCity = { cityId: string | null; cityName: string | null };

// Récupère le profil de l'utilisateur COURANT via la RPC `get_my_profile`
// (`security definer`, bornée à auth.uid()). On NE lit PAS la table en direct :
// birth_date n'est plus exposée par PostgREST (durcissement brique 3) et le GPS est
// masqué. Renvoie `null` si la ligne n'existe pas encore (cas pré-onboarding).
export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();
  if (error) throw error;
  return data;
}

// Met à jour les champs éditables du profil, renvoie la ligne à jour. La ligne
// existe TOUJOURS déjà (le trigger d'inscription la crée) -> update (pas upsert).
// On NE fait PAS de `.select()` en RETURNING : il inclurait birth_date, désormais
// non lisible en direct (42501). On relit donc via fetchProfile (get_my_profile).
// C'est aussi par cette fonction que passe l'onboarding (champ display_name seul).
export async function updateProfile(
  userId: string,
  fields: ProfileEdit,
): Promise<Profile> {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw error;
  const profile = await fetchProfile();
  if (!profile) throw new Error("Profil introuvable après mise à jour");
  return profile;
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
  return { cityId: data.matched_city_id, cityName: data.matched_city_name };
}
