import { FieldLabel } from "@/components/FieldLabel";
import type { InvitationDetail } from "@/data/invitations";
import { colors, fontSize, radius, space } from "@/theme";
import {
  formatDateLong,
  formatTimeDisplay,
  parseLocalDate,
  parseLocalTime,
  TIME_SLOT_LABELS,
} from "@/utils/datetime";
import { formatPlaceDistance } from "@/utils/person-format";
import CalendarIcon from "@expo/material-symbols/calendar_month.xml";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import ClockIcon from "@expo/material-symbols/schedule.xml";
import { Host, Icon } from "@expo/ui";
import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

// Petite icône native (SF iOS / Material XML Android) alignée sur une ligne de texte.
// `name` reprend exactement le type de la prop d'Icon (ios = SFSymbol, android = XML).
function RowIcon({ name }: { name: ComponentProps<typeof Icon>["name"] }) {
  return (
    <Host matchContents>
      <Icon name={name} size={16} color={colors.textMeta} />
    </Host>
  );
}

// Récapitulatif LECTURE SEULE d'une invitation (activité / date & heure / lieu / message),
// dans des lignes pleines gris clair. Réutilisé par l'écran détail (reçue et envoyée).
export function InvitationCard({ detail }: { detail: InvitationDetail }) {
  const dateText = formatDateLong(parseLocalDate(detail.scheduled_date));
  const timeText = detail.time_slot
    ? TIME_SLOT_LABELS[detail.time_slot]
    : detail.scheduled_time
      ? formatTimeDisplay(parseLocalTime(detail.scheduled_time))
      : "Flexible";

  const locationSubtitle = [
    detail.location_address,
    detail.location_distance_m !== null
      ? formatPlaceDistance(detail.location_distance_m)
      : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={styles.wrap}>
      <FieldLabel>ACTIVITY</FieldLabel>
      <View style={styles.filledRow}>
        <Text style={styles.value}>{detail.activity_name}</Text>
      </View>

      <FieldLabel>DATE & TIME</FieldLabel>
      <View style={[styles.filledRow, styles.dateRow]}>
        <View style={styles.inline}>
          <RowIcon name={{ ios: "calendar", android: CalendarIcon }} />
          <Text style={styles.value}>{dateText}</Text>
        </View>
        <View style={styles.inline}>
          <RowIcon name={{ ios: "clock", android: ClockIcon }} />
          <Text style={styles.value}>{timeText}</Text>
        </View>
      </View>

      {detail.location_id ? (
        <>
          <FieldLabel>LOCATION</FieldLabel>
          <View style={[styles.filledRow, styles.locRow]}>
            <RowIcon name={{ ios: "mappin", android: LocationIcon }} />
            <View style={styles.locBody}>
              <Text style={styles.value} numberOfLines={1}>
                {detail.location_name}
              </Text>
              {locationSubtitle ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {locationSubtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </>
      ) : null}

      {detail.message ? (
        <>
          <FieldLabel>MESSAGE</FieldLabel>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{detail.message}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxs },
  filledRow: {
    minHeight: 48,
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    justifyContent: "center",
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: space.xl },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  locRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  locBody: { flex: 1, gap: space.xxs },
  value: { fontSize: fontSize.body, color: colors.text },
  sub: { fontSize: fontSize.sub, color: colors.textMuted },
  messageBox: {
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  message: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
});
