import { colors, fontSize, radius, space } from "@/theme";
import { StyleSheet } from "react-native";

// Styles partagés par les champs du formulaire profil (lignes « valeur + chevron »,
// labels de section, pickers). Centralisés pour rester cohérents entre les champs.
export const fieldStyles = StyleSheet.create({
  label: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  row: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: fontSize.body, color: colors.text },
  rowPlaceholder: { fontSize: fontSize.body, color: colors.textFaint },
  chevron: { fontSize: fontSize.chevron, color: colors.chevron },
  hint: { fontSize: fontSize.hint, color: colors.textMuted, marginTop: space.xs },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    marginTop: space.xxs,
    justifyContent: "center",
  },
  picker: { color: colors.text },
  // Android : Picker transparent superposé à une ligne -> capte le tap (opacity 0
  // mais reçoit les touches) et ouvre le dialogue natif sans popup qui chevauche.
  hiddenPicker: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
  },
});
