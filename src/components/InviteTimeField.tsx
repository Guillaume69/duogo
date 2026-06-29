import type { Enums } from "@/lib/database.types";
import {
  formatTimeDisplay,
  TIME_SLOT_LABELS,
  TIME_SLOT_VALUES,
} from "@/lib/datetime";
import { colors, fontSize, radius, space } from "@/theme";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  slot: Enums<"time_slot"> | null;
  time: Date | null;
  onSlot: (slot: Enums<"time_slot">) => void;
  onPickTime: (d: Date) => void;
  onClear: () => void;
};

// Heure d'une invitation (FACULTATIVE) : un CRÉNEAU (Morning/Afternoon/Evening) OU une
// heure PRÉCISE via le time picker NATIF, jamais les deux (les setters du brouillon
// maintiennent l'exclusivité). Tap sur le créneau actif = on le retire (retour flexible).
export function InviteTimeField({ slot, time, onSlot, onPickTime, onClear }: Props) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  function openTimePicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: time ?? new Date(),
        mode: "time",
        onValueChange: (_event, selected) => onPickTime(selected),
      });
    } else {
      setShowIosPicker(true);
    }
  }

  const hasSelection = slot !== null || time !== null;

  return (
    <>
      <View style={styles.row}>
        {TIME_SLOT_VALUES.map((s) => {
          const on = slot === s;
          return (
            <Pressable
              key={s}
              onPress={() => (on ? onClear() : onSlot(s))}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {TIME_SLOT_LABELS[s]}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={openTimePicker}
          style={[styles.chip, time !== null && styles.chipOn]}
        >
          <Text style={[styles.chipText, time !== null && styles.chipTextOn]}>
            {time !== null ? formatTimeDisplay(time) : "Exact time"}
          </Text>
        </Pressable>
      </View>

      {hasSelection && (
        <Pressable onPress={onClear} hitSlop={6}>
          <Text style={styles.clear}>Clear time</Text>
        </Pressable>
      )}

      {showIosPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={time ?? new Date()}
          mode="time"
          display="spinner"
          onValueChange={(_event, selected) => onPickTime(selected)}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  chipOn: { backgroundColor: colors.fillDark },
  chipText: { fontSize: fontSize.chip, color: colors.text },
  chipTextOn: { color: colors.textOnDark, fontWeight: "600" },
  clear: {
    fontSize: fontSize.sub,
    color: colors.accent,
    fontWeight: "600",
    marginTop: space.sm,
  },
});
