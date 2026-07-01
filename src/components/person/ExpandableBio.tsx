import { colors, fontSize, space } from "@/theme";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Bio pliable, auto-contenue. On mesure le nombre de lignes RÉELLES (calque invisible sans clamp)
// pour décider du « Read More » de façon fiable quel que soit le contenu, puis on clampe
// l'affichage à PREVIEW_LINES tant qu'elle n'est pas dépliée. Tout l'état (déplié, nb de lignes)
// vit ici -> l'écran ne fait que passer le texte.
const PREVIEW_LINES = 4;

export function ExpandableBio({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Nombre de lignes réelles de la bio (mesuré sans clamp) -> décide du « Read More ».
  const [lineCount, setLineCount] = useState<number | null>(null);
  const canExpand = lineCount !== null && lineCount > PREVIEW_LINES;

  return (
    // gap: le lien « Read More » garde l'écart (space.sm) qu'il tenait de la section parente
    // avant l'extraction (le calque de mesure absolu ci-dessous reste hors flux -> ignoré du gap).
    <View style={styles.root}>
      {/* Mesure invisible (sans clamp) pour compter les lignes réelles. */}
      <View pointerEvents="none" style={styles.measure}>
        <Text
          style={styles.bio}
          onTextLayout={(e) => setLineCount(e.nativeEvent.lines.length)}
        >
          {text}
        </Text>
      </View>
      <Text style={styles.bio} numberOfLines={expanded ? undefined : PREVIEW_LINES}>
        {text}
      </Text>
      {canExpand ? (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={6}>
          <Text style={styles.link}>{expanded ? "Read less" : "Read More"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  bio: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  // Calque de mesure : occupe la place mais invisible et non cliquable.
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  link: { fontSize: fontSize.sub, color: colors.accent, fontWeight: "600" },
});
