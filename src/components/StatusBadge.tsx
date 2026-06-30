import type { Enums } from "@/lib/database.types";
import { colors, fontSize, radius, space } from "@/theme";
import {
  INVITATION_STATUS_LABELS,
  invitationStatusColor,
} from "@/utils/invitation-format";
import { StyleSheet, Text, View } from "react-native";

// Pastille de statut d'une invitation (Pending / Accepted / Denied / Asked Changes).
// Fond coloré par statut, texte blanc — réutilisée par les lignes d'Inbox et le détail.
export function StatusBadge({ status }: { status: Enums<"invitation_status"> }) {
  return (
    <View style={[styles.badge, { backgroundColor: invitationStatusColor(status) }]}>
      <Text style={styles.text}>{INVITATION_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
  },
  text: { fontSize: fontSize.label, fontWeight: "700", color: colors.textOnDark },
});
