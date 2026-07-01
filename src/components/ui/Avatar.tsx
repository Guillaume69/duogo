import { peekSignedAvatarUrl, signedAvatarUrl } from "@/data/avatars";
import { colors } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// Avatar circulaire. `path` = avatar_path stocké (bucket privé) -> on résout une
// URL signée à l'affichage. Sans avatar : initiale sur fond gris (placeholder natif).
type Props = { path: string | null; size: number; label?: string | null };

export function Avatar({ path, size, label }: Props) {
  // On mémorise l'URL signée AVEC son path d'origine -> l'URI affichée est dérivée
  // (recalculée si le path change), donc pas de setState synchrone dans l'effet et
  // jamais d'avatar périmé pendant un changement. Init depuis le cache (peek
  // synchrone) : si l'URL est déjà connue, on l'affiche dès le 1er rendu (pas de flash).
  const [loaded, setLoaded] = useState<{ path: string; uri: string } | null>(
    () => {
      if (!path) return null;
      const cached = peekSignedAvatarUrl(path);
      return cached ? { path, uri: cached } : null;
    },
  );

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    signedAvatarUrl(path)
      .then((signed) => {
        if (!cancelled) setLoaded({ path, uri: signed });
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Si `loaded` correspond au path courant -> on l'utilise. Sinon (path qui vient de
  // changer sur un composant déjà monté) on retente le cache synchrone avant de
  // retomber sur le placeholder -> pas de flash si l'URL est déjà connue.
  const uri =
    loaded && loaded.path === path
      ? loaded.uri
      : path
        ? peekSignedAvatarUrl(path)
        : null;
  const initial = (label ?? "").trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={path ?? undefined}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
          {initial || "?"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.fillPlaceholder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initial: { color: colors.textMuted, fontWeight: "600" },
});
