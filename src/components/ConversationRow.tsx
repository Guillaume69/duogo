import { Avatar } from "@/components/Avatar";
import type { ConversationListItem } from "@/data/conversations";
import { colors, fontSize, radius, space } from "@/theme";
import { formatRelativeShort } from "@/utils/datetime";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  conversation: ConversationListItem;
  onPress: () => void;
};

// Ligne d'une conversation dans la liste Chats : avatar de l'autre, son nom, l'aperçu du
// dernier message + le temps relatif, l'activité en chip, et le badge « Your Turn » quand
// j'ai des messages non lus (cf. maquette). Tap -> écran de chat.
export function ConversationRow({ conversation, onPress }: Props) {
  const yourTurn = conversation.unread_count > 0;

  // Aperçu du dernier message : « You: … » si c'est le mien ; invite à démarrer si vierge.
  const preview =
    conversation.last_message_body === null
      ? "You matched — say hi 👋"
      : conversation.last_message_mine
        ? `You: ${conversation.last_message_body}`
        : conversation.last_message_body;
  const when = conversation.last_message_at ?? conversation.created_at;

  return (
    <Pressable
      unstable_pressDelay={130}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Avatar
        path={conversation.other_avatar_path}
        size={48}
        label={conversation.other_name}
      />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.other_name}
          </Text>
          {yourTurn ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Your Turn</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[styles.preview, yourTurn && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          <Text style={styles.meta}>{formatRelativeShort(when)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {conversation.activity_name}
          </Text>
        </View>
      </View>
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    gap: space.sm,
  },
  name: { flex: 1, fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  badge: {
    backgroundColor: colors.fillDark,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xxs,
  },
  badgeText: { fontSize: fontSize.label, fontWeight: "700", color: colors.textOnDark },
  previewRow: {
    flexDirection: "row",
    alignItems: "baseline",
    alignSelf: "stretch",
    gap: space.xs,
  },
  preview: { flex: 1, fontSize: fontSize.sub, color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: "600" },
  meta: { flexShrink: 0, fontSize: fontSize.sub, color: colors.textFaint },
  chip: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    maxWidth: "100%",
  },
  chipText: { fontSize: fontSize.label, color: colors.textMeta },
});
