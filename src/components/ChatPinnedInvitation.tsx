import type { ConversationDetail } from "@/data/conversations";
import { colors, fontSize, radius, space } from "@/theme";
import {
  formatDateLong,
  formatTimeDisplay,
  parseLocalDate,
  parseLocalTime,
  TIME_SLOT_LABELS,
} from "@/utils/datetime";
import CalendarIcon from "@expo/material-symbols/calendar_month.xml";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import ClockIcon from "@expo/material-symbols/schedule.xml";
import { Host, Icon } from "@expo/ui";
import { type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Petite icône native alignée sur le texte (même motif que InvitationCard).
function RowIcon({ name }: { name: ComponentProps<typeof Icon>["name"] }) {
  return (
    <Host matchContents>
      <Icon name={name} size={14} color={colors.textMeta} />
    </Host>
  );
}

// Carte épinglée en tête du fil : rappelle l'invitation d'origine du match (« Invitation to
// play <activité> » + date/heure + lieu). Tap -> détail de l'invitation (lecture seule).
export function ChatPinnedInvitation({
  detail,
  onPress,
}: {
  detail: ConversationDetail;
  onPress: () => void;
}) {
  const dateText = formatDateLong(parseLocalDate(detail.scheduled_date));
  const timeText = detail.time_slot
    ? TIME_SLOT_LABELS[detail.time_slot]
    : detail.scheduled_time
      ? formatTimeDisplay(parseLocalTime(detail.scheduled_time))
      : "Flexible";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={styles.title}>
        Invitation to play <Text style={styles.activity}>{detail.activity_name}</Text>
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.inline}>
          <RowIcon name={{ ios: "calendar", android: CalendarIcon }} />
          <Text style={styles.meta}>{dateText}</Text>
        </View>
        <View style={styles.inline}>
          <RowIcon name={{ ios: "clock", android: ClockIcon }} />
          <Text style={styles.meta}>{timeText}</Text>
        </View>
      </View>
      {detail.location_name ? (
        <View style={styles.inline}>
          <RowIcon name={{ ios: "mappin", android: LocationIcon }} />
          <Text style={styles.meta} numberOfLines={1}>
            {detail.location_name}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    maxWidth: "92%",
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
  title: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  activity: { color: colors.accent, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xl },
  inline: { flexDirection: "row", alignItems: "center", gap: space.xs },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
});
