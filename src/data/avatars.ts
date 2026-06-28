import { supabase } from "@/lib/supabase";

// Couche d'accès au Storage des avatars (bucket privé `avatars`). Convention de
// chemin OBLIGATOIRE : `<userId>/<fichier>` — c'est le 1er segment qui porte la
// policy RLS (un user n'écrit que dans son dossier).

const BUCKET = "avatars";

// L'URL signée a une durée de vie ; on la met en cache pour NE PAS en regénérer une
// nouvelle à chaque affichage. Sans cache, chaque montage produit une URL différente
// -> expo-image voit une nouvelle clé -> re-télécharge (flash « avatar vide »). En
// réutilisant la même URL tant qu'elle est valide, expo-image sert depuis son cache.
const SIGNED_TTL_SECONDS = 3600;
// Marge de sécurité : on renouvelle un peu avant l'expiration réelle.
const REFRESH_BEFORE_MS = 5 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Upload l'image (URI local d'expo-image-picker) et renvoie le path stocké.
// RN n'a pas de File/FormData fiable -> on lit l'URI en ArrayBuffer (pattern Expo).
export async function uploadAvatar(
  userId: string,
  uri: string,
  mimeType: string | undefined,
): Promise<string> {
  const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: mimeType ?? "image/jpeg",
      upsert: true,
    });
  if (error) throw error;
  return path;
}

// Lecture SYNCHRONE du cache : renvoie l'URL signée si elle est encore valide, sinon
// null. Sert à initialiser l'affichage sans attendre (évite le flash au retour).
export function peekSignedAvatarUrl(path: string): string | null {
  const hit = signedUrlCache.get(path);
  if (hit && hit.expiresAt - REFRESH_BEFORE_MS > Date.now()) return hit.url;
  return null;
}

// URL signée (bucket privé) pour AFFICHER un avatar. Réutilise l'URL en cache tant
// qu'elle est valide ; n'en regénère une que si nécessaire.
export async function signedAvatarUrl(path: string): Promise<string> {
  const cached = peekSignedAvatarUrl(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error) throw error;
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

// Pré-charge en UNE requête les URLs signées de plusieurs avatars (listes : Browse…)
// et remplit le MÊME cache que signedAvatarUrl. Le composant Avatar lit ensuite le
// cache en synchrone (peek) -> pas de flash, pas de N requêtes réseau. On ne signe
// que les paths absents du cache, et un avatar isolé en erreur n'empêche pas le reste.
export async function warmSignedAvatarUrls(paths: string[]): Promise<void> {
  const missing = [...new Set(paths)].filter((p) => !peekSignedAvatarUrl(p));
  if (missing.length === 0) return;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(missing, SIGNED_TTL_SECONDS);
  if (error) throw error;
  const expiresAt = Date.now() + SIGNED_TTL_SECONDS * 1000;
  for (const row of data) {
    if (row.signedUrl && row.path) {
      signedUrlCache.set(row.path, { url: row.signedUrl, expiresAt });
    }
  }
}
