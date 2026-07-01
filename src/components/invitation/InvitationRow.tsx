import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/invitation/StatusBadge";
import type { InboxInvitation } from "@/data/invitations";
import { colors, fontSize, radius, space } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  invitation: InboxInvitation;
  onPress: () => void;
};

// Ligne d'une invitation dans l'Inbox (reçues ou envoyées) : avatar de l'autre, son nom,
// l'activité en chip, et le badge de statut à droite. Tap -> détail de l'invitation.
export function InvitationRow({ invitation, onPress }: Props) {
  return (
    <Pressable
      unstable_pressDelay={130}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Avatar
        path={invitation.other_avatar_path}
        size={48}
        label={invitation.other_name}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {invitation.other_name}
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {invitation.activity_name}
          </Text>
        </View>
      </View>
      <StatusBadge status={invitation.status} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  pressed: { backgroundColor: colors.fill },
  body: { flex: 1, gap: space.xs, alignItems: "flex-start" },
  name: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  chip: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    maxWidth: "100%",
  },
  chipText: { fontSize: fontSize.label, color: colors.textMeta },
});
