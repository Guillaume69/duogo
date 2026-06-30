import { Avatar } from "@/components/Avatar";
import { InterestChips } from "@/components/InterestChips";
import { fetchMyActivityIds } from "@/data/activities";
import { fetchPerson, type Person } from "@/data/people";
import { useLocation } from "@/providers/location";
import { firstName, formatPersonMeta } from "@/utils/person-format";
import { useProfile } from "@/providers/profile";
import { colors, fontSize, radius, space } from "@/theme";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import { Host, Icon } from "@expo/ui";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
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
// L'action principale dépend du « tour » de l'invitation active (cf. plus bas).
type Status = "loading" | "error" | "notfound" | "ready";

// Au-delà de ce nombre de lignes RÉELLES, on plie la bio derrière un « Read More ».
const BIO_PREVIEW_LINES = 4;

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { city } = useLocation();
  const { profile } = useProfile();
  const router = useRouter();
  const userId = profile?.id ?? null;

  const [status, setStatus] = useState<Status>("loading");
  const [person, setPerson] = useState<Person | null>(null);
  const [myActivityIds, setMyActivityIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bioExpanded, setBioExpanded] = useState(false);
  // Nombre de lignes réelles de la bio (mesuré sans clamp) -> décide du « Read More ».
  const [bioLineCount, setBioLineCount] = useState<number | null>(null);
  // Premier chargement effectué ? On ne montre le spinner plein écran (et les écrans
  // d'erreur/notfound) qu'au PREMIER passage ; les rechargements au focus (retour de la
  // modale d'invitation -> already_invited à jour) se font en silence, sans flash.
  const loadedOnceRef = useRef(false);

  // Chargement. fetchPerson est CRITIQUE (son échec = écran d'erreur AU 1ER CHARGEMENT) ;
  // fetchMyActivityIds est SECONDAIRE (intérêts communs) -> échec neutralisé (-> []).
  // `signal.cancelled` ignore un résultat tardif (démontage / refocus). setState après await.
  const doLoad = useCallback(
    async (signal: { cancelled: boolean }) => {
      const minePromise = userId
        ? fetchMyActivityIds(userId).catch(() => [])
        : Promise.resolve<string[]>([]);
      if (!loadedOnceRef.current) setStatus("loading");
      let p: Person | null;
      try {
        p = id ? await fetchPerson(id) : null;
      } catch {
        // Échec silencieux après un 1er chargement réussi (rafraîchissement au focus).
        if (!signal.cancelled && !loadedOnceRef.current) setStatus("error");
        return;
      }
      const mine = await minePromise;
      if (signal.cancelled) return;
      setMyActivityIds(new Set(mine));
      if (!p) {
        if (!loadedOnceRef.current) setStatus("notfound");
        return;
      }
      setPerson(p);
      setStatus("ready");
      loadedOnceRef.current = true;
    },
    [id, userId],
  );

  // Rejoué à CHAQUE focus : au retour de la modale d'invitation, la fiche relit
  // already_invited et le bouton bascule sur « Invited » sans action manuelle.
  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      doLoad(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [doLoad]),
  );

  // Retry depuis l'écran d'erreur (1er chargement échoué) : relance un chargement
  // (loadedOnceRef encore false -> on repasse bien par le spinner plein écran).
  function onRetry() {
    loadedOnceRef.current = false;
    doLoad({ cancelled: false });
  }

  function onInvite() {
    if (!person) return;
    router.push({
      pathname: "/invite/[id]",
      params: { id: person.id, name: person.display_name },
    });
  }

  // Ouvre l'invitation active entre nous (à répondre ou à consulter).
  function onOpenInvitation() {
    if (!person?.active_invitation_id) return;
    router.push(`/invitation/${person.active_invitation_id}`);
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

          {/* Action principale, selon le « tour » de l'invitation active entre nous :
              - cette personne m'a invité (invited_by_them) -> « Respond to invitation » ;
              - je l'ai invitée, j'attends (already_invited) -> « Invited » (consultable) ;
              - aucune invitation active -> « Invite to Activity » (ouvre la composition). */}
          {person.invited_by_them && person.active_invitation_id ? (
            <Pressable
              style={({ pressed }) => [
                styles.inviteBtn,
                styles.inviteBtnActive,
                pressed && styles.pressed,
              ]}
              onPress={onOpenInvitation}
            >
              <Text style={styles.inviteTextActive}>Respond to invitation</Text>
            </Pressable>
          ) : person.already_invited ? (
            <View>
              <Pressable
                style={({ pressed }) => [
                  styles.inviteBtn,
                  styles.invitedBtn,
                  pressed && styles.pressed,
                ]}
                onPress={onOpenInvitation}
                disabled={!person.active_invitation_id}
              >
                <Text style={styles.invitedText}>Invited</Text>
              </Pressable>
              <Text style={styles.inviteHint}>Waiting for a reply</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.inviteBtn,
                styles.inviteBtnActive,
                pressed && styles.pressed,
              ]}
              onPress={onInvite}
            >
              <Text style={styles.inviteTextActive}>Invite to Activity</Text>
            </Pressable>
          )}

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
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnActive: { backgroundColor: colors.fillDark },
  inviteTextActive: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.textOnDark,
  },
  invitedBtn: { backgroundColor: colors.fill },
  invitedText: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  pressed: { opacity: 0.85 },
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
