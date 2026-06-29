import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « locations » (lieux de rendez-vous). On NE sélectionne JAMAIS le
// geog (geography illisible côté client) : tout passe par la RPC find_nearby_locations
// qui ne renvoie qu'une distance. Type dérivé des types générés -> zéro `as`.
//
// NB : le générateur type `address` en non-null, mais la colonne est nullable (adresse
// facultative) -> elle peut être null au runtime. On resserre le type localement pour
// rendre la garde obligatoire côté UI (cf. filter(Boolean) dans invite/[id].tsx).
type RawNearbyLocation =
  Database["public"]["Functions"]["find_nearby_locations"]["Returns"][number];
export type NearbyLocation = Omit<RawNearbyLocation, "address"> & {
  address: string | null;
};

// Liste les lieux de MA ville SERVANT l'activité donnée, triés par proximité (distance
// EXACTE — lieux publics). La RPC se borne à auth.uid() ; 0 lieu si je n'ai pas de ville
// (hors zone) ou si aucun lieu seedé ne couvre cette activité.
export async function findNearbyLocations(
  activityId: string,
): Promise<NearbyLocation[]> {
  const { data, error } = await supabase.rpc("find_nearby_locations", {
    p_activity_id: activityId,
  });
  if (error) throw error;
  return data ?? [];
}
