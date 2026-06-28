import { Avatar } from "@/components/Avatar";
import { InterestChips } from "@/components/InterestChips";
import { fetchMyActivityIds } from "@/data/activities";
import { fetchPerson, type Person } from "@/data/people";
import { useLocation } from "@/lib/location";
import { formatPersonMeta } from "@/lib/person-format";
import { useProfile } from "@/lib/profile";
import { colors, fontSize, radius, space } from "@/theme";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import { Host, Icon } from "@expo/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Fiche détail d'une personne (poussée depuis Browse). La RPC get_person ne renvoie
// jamais de coordonnées — uniquement l'âge, une distance grossière, la bio et les
// intérêts. La ville est la mienne (matching intra-ville) -> lue du LocationProvider.
// « Invite to Activity » est inactif jusqu'à la brique 4.
type Status = "loading" | "error" | "notfound" | "ready";

// Au-delà de ce nombre de lignes RÉELLES, on plie la bio derrière un « Read More ».
const BIO_PREVIEW_LINES = 4;

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { city } = useLocation();
  const { profile } = useProfile();
  const userId = profile?.id ?? null;

  const [status, setStatus] = useState<Status>("loading");
  const [person, setPerson] = useState<Person | null>(null);
  const [myActivityIds, setMyActivityIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bioExpanded, setBioExpanded] = useState(false);
  // Nombre de lignes réelles de la bio (mesuré sans clamp) -> décide du « Read More ».
  const [bioLineCount, setBioLineCount] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Chargement. fetchPerson est CRITIQUE (son échec = écran d'erreur) ; fetchMyActivityIds
  // est SECONDAIRE (sert juste à mettre en avant les intérêts communs) -> un échec ne
  // doit pas bloquer la fiche, on le neutralise (-> []). setState toujours après await.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const minePromise = userId
        ? fetchMyActivityIds(userId).catch(() => [])
        : Promise.resolve<string[]>([]);
      let p: Person | null;
      try {
        p = id ? await fetchPerson(id) : null;
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      const mine = await minePromise;
      if (cancelled) return;
      setMyActivityIds(new Set(mine));
      if (!p) return setStatus("notfound");
      setPerson(p);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId, reloadKey]);

  function onRetry() {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }

  const canExpandBio =
    bioLineCount !== null && bioLineCount > BIO_PREVIEW_LINES;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: person?.display_name ?? "Profile" }} />

      {status === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : status === "error" ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Couldn’t load this profile.</Text>
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : status === "notfound" || !person ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Profile unavailable</Text>
          <Text style={styles.muted}>
            This person isn’t available right now.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerBlock}>
            <Avatar
              path={person.avatar_path}
              size={120}
              label={person.display_name}
            />
            <Text style={styles.name}>{person.display_name}</Text>
            <View style={styles.metaRow}>
              <Host matchContents>
                <Icon
                  name={{ ios: "mappin", android: LocationIcon }}
                  size={16}
                  color={colors.textMeta}
                />
              </Host>
              <Text style={styles.meta}>
                {formatPersonMeta(
                  city?.cityName,
                  person.age,
                  person.distance_m,
                )}
              </Text>
            </View>
          </View>

          {/* Action principale — inactive jusqu'à la brique 4 (flux d'invitation). */}
          <View>
            <Pressable style={styles.inviteBtn} disabled>
              <Text style={styles.inviteText}>Invite to Activity</Text>
            </Pressable>
            <Text style={styles.inviteHint}>Available soon</Text>
          </View>

          {person.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                About {firstName(person.display_name)}
              </Text>
              {/* Mesure invisible (sans clamp) pour compter les lignes réelles et
                  décider du « Read More » de façon fiable, quel que soit le contenu. */}
              <View pointerEvents="none" style={styles.bioMeasure}>
                <Text
                  style={styles.bio}
                  onTextLayout={(e) =>
                    setBioLineCount(e.nativeEvent.lines.length)
                  }
                >
                  {person.bio}
                </Text>
              </View>
              <Text
                style={styles.bio}
                numberOfLines={bioExpanded ? undefined : BIO_PREVIEW_LINES}
              >
                {person.bio}
              </Text>
              {canExpandBio && (
                <Pressable onPress={() => setBioExpanded((v) => !v)} hitSlop={6}>
                  <Text style={styles.link}>
                    {bioExpanded ? "Read less" : "Read More"}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {person.activity_names.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <InterestChips
                activityIds={person.activity_ids}
                activityNames={person.activity_names}
                myActivityIds={myActivityIds}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// Premier mot du pseudo, pour le titre « About <prénom> » (cf. mock).
function firstName(displayName: string): string {
  return displayName.trim().split(" ")[0];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
  retry: {
    marginTop: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
  },
  retryText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.textOnDark,
  },
  scroll: { padding: space.xl, gap: space.xl },
  headerBlock: { alignItems: "center", gap: space.sm },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
  inviteBtn: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteText: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  inviteHint: {
    fontSize: fontSize.hint,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.xs,
  },
  section: { gap: space.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  bio: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  // Calque de mesure : occupe la place mais invisible et non cliquable.
  bioMeasure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  link: { fontSize: fontSize.sub, color: colors.accent, fontWeight: "600" },
});
