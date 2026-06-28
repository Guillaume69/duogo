import type { Tables } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « activities » + liaison N-N « profile_activities » (centres
// d'intérêt). Catalogue seedé en lecture seule ; les liaisons sont éditables par
// l'utilisateur pour SON profil (RLS).

export type Activity = Omit<Tables<"activities">, "created_at">;

const ACTIVITY_COLUMNS = "id, slug, name, description, sort_order";

// Catalogue complet, ordonné pour l'affichage.
export async function fetchActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .order("sort_order");
  if (error) throw error;
  return data;
}

// Ids des activités d'un profil (pour pré-cocher le multi-select).
export async function fetchMyActivityIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("profile_activities")
    .select("activity_id")
    .eq("profile_id", profileId);
  if (error) throw error;
  return data.map((row) => row.activity_id);
}

// Aligne les liaisons du profil sur l'ensemble voulu : on calcule le diff et on
// n'écrit que les changements (insert des ajouts, delete des retraits). RLS :
// insert/delete sont bornés à `profile_id = auth.uid()`.
export async function setMyActivities(
  profileId: string,
  activityIds: string[],
): Promise<void> {
  const current = await fetchMyActivityIds(profileId);
  const toAdd = activityIds.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !activityIds.includes(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("profile_activities")
      .delete()
      .eq("profile_id", profileId)
      .in("activity_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("profile_activities")
      .insert(toAdd.map((activityId) => ({ profile_id: profileId, activity_id: activityId })));
    if (error) throw error;
  }
}
