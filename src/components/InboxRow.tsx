import { Avatar } from "@/components/Avatar";
import type { InboxItem } from "@/data/inbox";
import { colors, fontSize, radius, space } from "@/theme";
import { formatRelativeShort } from "@/utils/datetime";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  item: InboxItem;
  onPress: () => void;
};

// Ligne du flux Inbox unifié : UNE personne, quel que soit l'état du fil (invitation qui
// m'attend OU conversation). L'aperçu et le badge « Your Turn » (needs_me) découlent de `state` ;
// l'activité en chip ; le temps relatif à droite. Le tap est câblé par l'écran (chat ou détail
// d'invitation selon `kind`).
export function InboxRow({ item, onPress }: Props) {
  return (
    <Pressable
      unstable_pressDelay={130}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Avatar path={item.other_avatar_path} size={48} label={item.other_name} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.other_name}
          </Text>
          {item.needs_me ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Your Turn</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[styles.preview, item.needs_me && styles.previewStrong]}
            numberOfLines={1}
          >
            {previewFor(item)}
          </Text>
          <Text style={styles.meta}>{formatRelativeShort(item.sort_ts)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {item.activity_name}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// Aperçu selon l'état du fil. Invitations / nouveau match = libellé fixe (pas encore d'échange) ;
// message = « You: … » si le dernier est le mien. Le `default` couvre msg_unread/msg_read et tout
// état futur (state est un `text` côté base -> on reste robuste sans `as`).
function previewFor(item: InboxItem): string {
  switch (item.state) {
    case "invite_in":
      return "Sent you an invitation";
    case "invite_changes":
      return "Suggested changes to the plan";
    case "match_new":
      return "You matched — say hi 👋";
    default:
      if (item.last_message_body === null) return "You matched — say hi 👋";
      return item.last_message_mine
        ? `You: ${item.last_message_body}`
        : item.last_message_body;
  }
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
  previewStrong: { color: colors.text, fontWeight: "600" },
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
