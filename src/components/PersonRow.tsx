import { Avatar } from "@/components/Avatar";
import { InterestChips } from "@/components/InterestChips";
import type { NearbyPerson } from "@/data/people";
import { formatPersonMeta } from "@/lib/person-format";
import { colors, fontSize, radius, space } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  person: NearbyPerson;
  cityName: string | null;
  /** Activités de l'utilisateur courant -> les chips en commun sont mises en avant. */
  myActivityIds: Set<string>;
  onPress: () => void;
};

// Nombre de chips d'activités affichées avant le « +N ».
const MAX_CHIPS = 3;

// Ligne d'une personne dans Browse : avatar, nom, « ville · âge · ~distance » et
// quelques chips d'activités. Aucune coordonnée — uniquement la distance grossière.
export function PersonRow({ person, cityName, myActivityIds, onPress }: Props) {
  return (
    <Pressable
      // Délai d'activation : un scroll qui passe sous le doigt n'allume PAS le
      // surlignage (il ne s'active qu'au vrai appui, pas au défilement).
      unstable_pressDelay={130}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Avatar path={person.avatar_path} size={56} label={person.display_name} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {person.display_name}
          </Text>
          {/* Badge « Invited » = j'ai une invitation pending envoyée à cette personne.
              Pastille accent : un STATUT, visuellement distinct des chips d'activités grises. */}
          {person.already_invited && (
            <View style={styles.invitedBadge}>
              <Text style={styles.invitedText}>Invited</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {formatPersonMeta(cityName, person.age, person.distance_m)}
        </Text>
        {person.activity_names.length > 0 && (
          <View style={styles.chipsWrap}>
            <InterestChips
              activityIds={person.activity_ids}
              activityNames={person.activity_names}
              myActivityIds={myActivityIds}
              dense
              limit={MAX_CHIPS}
            />
          </View>
        )}
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
  body: { flex: 1, gap: space.xxs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { fontSize: fontSize.body, fontWeight: "600", color: colors.text, flexShrink: 1 },
  invitedBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  invitedText: { fontSize: fontSize.label, fontWeight: "700", color: colors.textOnDark },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
  chipsWrap: { marginTop: space.xxs },
});
