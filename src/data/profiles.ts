import type { Tables } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès aux données « profiles » : fonctions PURES (sans React) qui
// encapsulent les requêtes Supabase. Convention : elles LÈVENT en cas d'échec et
// renvoient la donnée directement — les appelants gèrent l'erreur via try/catch.
// Le typage vient des types générés (`Tables<...>`) -> zéro `as`.

export type Profile = Tables<"profiles">;

// Récupère le profil d'un utilisateur. Renvoie `null` si la ligne n'existe pas
// encore (cas pré-onboarding, toléré par `maybeSingle`). Lève si la requête échoue.
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Crée ou met à jour le pseudo de l'utilisateur, puis renvoie la ligne à jour.
// upsert (et pas un simple update) : robuste si la ligne du trigger manque ; et
// satisfait la RLS (branche insert -> policy INSERT `auth.uid() = id`, branche
// update -> policy UPDATE). `id` est requis par l'Insert (PK sans default) -> on le
// passe explicitement. Le trim normalise la valeur au plus près de la base.
export async function upsertDisplayName(
  userId: string,
  displayName: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName.trim() })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
