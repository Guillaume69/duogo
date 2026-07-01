import type { Activity } from "@/data/activities";
import { colors, fontSize, radius, space } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  activities: Activity[];
  selectedIds: string[];
  onToggle: (id: string) => void;
};

// Multi-select d'activités sous forme de pills. Sélectionné = pill pleine noire ;
// non sélectionné = pill grise (visible sur fond blanc).
export function ActivityChips({ activities, selectedIds, onToggle }: Props) {
  return (
    <View style={styles.chips}>
      {activities.map((a) => {
        const selected = selectedIds.includes(a.id);
        return (
          <Pressable
            key={a.id}
            onPress={() => onToggle(a.id)}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>
              {a.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xxs },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.fill,
  },
  chipOn: { backgroundColor: colors.fillDark, borderColor: colors.fillDark },
  chipText: { fontSize: fontSize.chip, color: colors.text },
  chipTextOn: { color: colors.textOnDark },
});
