import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Une personne renvoyée par la RPC find_nearby_people : on dérive le type des types
// générés (zéro `as`). Le GPS n'y figure JAMAIS ; seul distance_m (grossier, snappé
// ~1 km côté serveur) sort. NB : le générateur type avatar_path en non-null, mais il
// peut être null au runtime (user sans photo) -> le composant Avatar gère ce cas.
export type NearbyPerson =
  Database["public"]["Functions"]["find_nearby_people"]["Returns"][number];

// Une personne en fiche détail (RPC get_person). Mêmes garanties que find_nearby_people
// (jamais de coordonnées, distance grossière, âge et non la date) + la `bio`.
export type Person =
  Database["public"]["Functions"]["get_person"]["Returns"][number];

// Une tranche d'âge sélectionnée. max null = borne haute OUVERTE (« 46+ »).
export type AgeRange = { min: number; max: number | null };

// Sentinelle de borne haute pour le « 46+ » : les params RPC sont des int[] non-null,
// donc on encode « pas de plafond » par un grand entier plutôt qu'un NULL.
const OPEN_AGE_MAX = 200;

// Filtres de recherche (état du FilterProvider). Tout est optionnel : un champ
// absent = pas de filtre sur ce critère.
export type NearbyFilters = {
  radiusKm?: number;
  genders?: Database["public"]["Enums"]["gender"][];
  ageRanges?: AgeRange[];
  activityIds?: string[];
};

// Liste les gens découvrables de MA ville, triés par distance. La RPC se borne à
// auth.uid() et ne renvoie jamais de coordonnées. ⚠ Tableaux VIDES -> on passe
// `undefined` (= pas de filtre) pour ne pas vider la liste par mégarde. Les tranches
// d'âge sont envoyées en deux tableaux parallèles (la RPC matche « au moins une »).
export async function findNearbyPeople(
  filters: NearbyFilters = {},
): Promise<NearbyPerson[]> {
  const ranges = filters.ageRanges ?? [];
  const { data, error } = await supabase.rpc("find_nearby_people", {
    p_radius_km: filters.radiusKm,
    p_genders: filters.genders?.length ? filters.genders : undefined,
    p_age_mins: ranges.length ? ranges.map((r) => r.min) : undefined,
    p_age_maxs: ranges.length ? ranges.map((r) => r.max ?? OPEN_AGE_MAX) : undefined,
    p_activity_ids: filters.activityIds?.length ? filters.activityIds : undefined,
  });
  if (error) throw error;
  return data ?? [];
}

// Fiche détail d'une personne. La RPC se borne à auth.uid() et ne renvoie 0 ligne si
// la personne n'est pas visible pour l'appelant (autre ville, non découvrable, soi-même)
// -> on renvoie null et l'écran affiche « indisponible ».
export async function fetchPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase.rpc("get_person", { p_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}
