import { fieldStyles } from "@/components/fieldStyles";
import { colors, fontSize, space } from "@/theme";
import {
  BottomSheet,
  BottomSheetScrollView,
  BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PickerOption = { id: string; title: string; subtitle?: string };

type Props = {
  /** Texte de la ligne quand rien n'est sélectionné. */
  placeholder: string;
  /** Titre affiché en tête de la sheet. */
  sheetTitle: string;
  options: PickerOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Chargement des options (spinner dans la sheet). */
  loading?: boolean;
  /** Échec de chargement -> ligne « retry » dans la sheet. */
  error?: boolean;
  onRetry?: () => void;
  /** Option « aucun » (ex. lieu facultatif) : ligne en tête qui efface la sélection. */
  noneLabel?: string;
  onClear?: () => void;
  /** Non sélectionnable (ex. lieu tant qu'aucune activité n'est choisie) : ligne grisée. */
  disabled?: boolean;
};

// Sélecteur single-select générique : une ligne (cohérente avec GenderField/DOB) qui
// ouvre la bottom-sheet NATIVE `@expo/ui`. Réutilisé pour l'activité et le lieu d'une
// invitation. Le contenu a un fond clair explicite (app verrouillée en clair).
export function PickerField({
  placeholder,
  sheetTitle,
  options,
  selectedId,
  onSelect,
  loading = false,
  error = false,
  onRetry,
  noneLabel,
  onClear,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const selected = options.find((o) => o.id === selectedId) ?? null;

  function choose(id: string) {
    onSelect(id);
    sheetRef.current?.close();
  }
  function clear() {
    onClear?.();
    sheetRef.current?.close();
  }

  return (
    <>
      <Pressable
        style={[fieldStyles.row, disabled && styles.rowDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
      >
        <Text style={selected ? fieldStyles.rowText : fieldStyles.rowPlaceholder}>
          {selected ? selected.title : placeholder}
        </Text>
        <Text style={fieldStyles.chevron}>›</Text>
      </Pressable>

      {open && !disabled && (
        <BottomSheet
          ref={sheetRef}
          onClose={() => setOpen(false)}
          enablePanDownToClose
          handleComponent={null}
          backgroundStyle={styles.sheetBg}
        >
          <BottomSheetView
            style={[styles.content, { paddingBottom: insets.bottom + space.md }]}
          >
            <Text style={styles.title}>{sheetTitle}</Text>

            {loading ? (
              <ActivityIndicator style={styles.spinner} />
            ) : error ? (
              <Pressable onPress={onRetry} hitSlop={8} style={styles.option}>
                <Text style={styles.errorText}>Couldn’t load. Tap to retry.</Text>
              </Pressable>
            ) : options.length === 0 && !noneLabel ? (
              // Catalogue vide et pas d'option « aucun » -> message plutôt qu'une sheet vide.
              <Text style={styles.empty}>Nothing available yet.</Text>
            ) : (
              <BottomSheetScrollView style={styles.list}>
                {noneLabel && (
                  <Pressable
                    onPress={clear}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedId === null && styles.optionSelected,
                      ]}
                    >
                      {noneLabel}
                    </Text>
                    {selectedId === null && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                )}
                {options.map((opt, i) => {
                  const isSel = opt.id === selectedId;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => choose(opt.id)}
                      style={({ pressed }) => [
                        styles.option,
                        (i > 0 || noneLabel) && styles.divider,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.optionBody}>
                        <Text style={[styles.optionText, isSel && styles.optionSelected]}>
                          {opt.title}
                        </Text>
                        {opt.subtitle ? (
                          <Text style={styles.subtitle}>{"\n" + opt.subtitle}</Text>
                        ) : null}
                      </Text>
                      {isSel && <Text style={styles.check}>✓</Text>}
                    </Pressable>
                  );
                })}
              </BottomSheetScrollView>
            )}
          </BottomSheetView>
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  rowDisabled: { opacity: 0.45 },
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
  spinner: { paddingVertical: space.xl },
  empty: { fontSize: fontSize.sub, color: colors.textMuted, paddingVertical: space.xl },
  // Hauteur bornée : au-delà, la liste défile (BottomSheetScrollView natif).
  list: { maxHeight: 360 },
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
  optionBody: { flex: 1, paddingRight: space.md },
  optionText: { fontSize: fontSize.body, color: colors.text },
  optionSelected: { fontWeight: "600" },
  subtitle: { fontSize: fontSize.sub, color: colors.textMuted },
  check: { fontSize: fontSize.body, color: colors.accent, fontWeight: "700" },
  errorText: { fontSize: fontSize.sub, color: colors.accent },
});
