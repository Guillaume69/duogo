import { fieldStyles } from "@/components/ui/fieldStyles";
import type { Enums } from "@/lib/database.types";
import { GENDER_LABELS, GENDER_VALUES } from "@/utils/profile-fields";
import { colors, fontSize, space } from "@/theme";
import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  value: Enums<"gender"> | null;
  onChange: (gender: Enums<"gender">) => void;
};

// Sélecteur de genre : une ligne (cohérente avec LOCATION/DOB) qui ouvre la
// bottom-sheet NATIVE de `@expo/ui` (ModalBottomSheet Material 3 / SwiftUI). On y
// met nos propres options (titre, séparateurs, coche). Le contenu a un fond clair
// explicite (l'app est verrouillée en clair).
export function GenderField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  function pick(gender: Enums<"gender">) {
    onChange(gender);
    sheetRef.current?.close();
  }

  return (
    <>
      <Pressable style={fieldStyles.row} onPress={() => setOpen(true)}>
        <Text style={value ? fieldStyles.rowText : fieldStyles.rowPlaceholder}>
          {value ? GENDER_LABELS[value] : "Select gender"}
        </Text>
        <Text style={fieldStyles.chevron}>›</Text>
      </Pressable>

      {open && (
        <BottomSheet
          ref={sheetRef}
          onClose={() => setOpen(false)}
          enablePanDownToClose
          // Pas de handle natif (il avait un effet de press au toucher, indésirable).
          handleComponent={null}
          // Colore le CONTENEUR natif de la sheet (sinon il suit le dark système ->
          // bandes noires autour du contenu).
          backgroundStyle={styles.sheetBg}
        >
          <BottomSheetView
            style={[styles.content, { paddingBottom: insets.bottom + space.md }]}
          >
            <Text style={styles.title}>Select your gender</Text>
            {GENDER_VALUES.map((g, i) => {
              const selected = value === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => pick(g)}
                  style={({ pressed }) => [
                    styles.option,
                    i > 0 && styles.divider,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.optionText, selected && styles.optionSelected]}
                  >
                    {GENDER_LABELS[g]}
                  </Text>
                  {selected && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </BottomSheetView>
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface },
  content: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  title: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    paddingVertical: space.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  pressed: { opacity: 0.5 },
  optionText: { fontSize: fontSize.body, color: colors.text },
  optionSelected: { fontWeight: "600" },
  check: { fontSize: fontSize.body, color: colors.accent, fontWeight: "700" },
});
