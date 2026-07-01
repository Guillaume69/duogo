import { colors, fontSize, radius, space } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

// Affiche les intérêts d'une personne en chips, avec ceux EN COMMUN avec moi mis en
// avant (chip plus foncée + texte gras). Source unique partagée par PersonRow (dense,
// tronquée à `limit` + « +N ») et la fiche détail (toutes les chips, plus aérées).
type Props = {
  activityIds: string[];
  activityNames: string[];
  /** Mes intérêts -> les chips en commun sont mises en avant. */
  myActivityIds: Set<string>;
  /** Variante compacte (lignes de liste) vs aérée (fiche détail). */
  dense?: boolean;
  /** Nombre max de chips avant un « +N » (liste). Absent = toutes. */
  limit?: number;
};

export function InterestChips({
  activityIds,
  activityNames,
  myActivityIds,
  dense = false,
  limit,
}: Props) {
  const shown = limit ? activityNames.slice(0, limit) : activityNames;
  const extra = limit ? activityNames.length - limit : 0;
  return (
    <View style={styles.chips}>
      {shown.map((name, i) => {
        const mine = myActivityIds.has(activityIds[i]);
        return (
          <View
            key={activityIds[i]}
            style={[
              dense ? styles.chipDense : styles.chip,
              mine && styles.chipMine,
            ]}
          >
            <Text
              style={[
                dense ? styles.chipTextDense : styles.chipText,
                mine && styles.chipTextMine,
              ]}
            >
              {name}
            </Text>
          </View>
        );
      })}
      {extra > 0 && <Text style={styles.more}>+{extra}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  // Variante aérée (fiche détail).
  chip: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chipText: { fontSize: fontSize.chip, color: colors.textMeta },
  // Variante dense (ligne de liste).
  chipDense: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  chipTextDense: { fontSize: fontSize.label, color: colors.textMeta },
  // Intérêt en commun avec moi (les deux variantes) : fond plus foncé + texte gras.
  chipMine: { backgroundColor: colors.fillStrong },
  chipTextMine: { color: colors.text, fontWeight: "600" },
  more: { fontSize: fontSize.label, color: colors.textMuted },
});
