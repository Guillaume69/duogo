import { colors, fontSize, space } from "@/theme";
import FilterListIcon from "@expo/material-symbols/filter_list.xml";
import { Host, Icon } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";

// Bouton d'ouverture des filtres : icône NATIVE (SF Symbol sur iOS / Material Symbol
// sur Android via @expo/ui) + pastille du nombre de filtres actifs. L'Icon gère le tap
// (onPress natif) ; la pastille est un calque non interactif posé par-dessus.
export function FilterButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.btn}>
      <Host matchContents>
        <Icon
          name={{ ios: "line.3.horizontal.decrease", android: FilterListIcon }}
          size={24}
          color={colors.text}
          onPress={onPress}
        />
      </Host>
      {count > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: space.xs,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.textOnDark,
  },
});
