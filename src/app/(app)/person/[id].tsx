import { Avatar } from "@/components/Avatar";
import { ExpandableBio } from "@/components/ExpandableBio";
import { InterestChips } from "@/components/InterestChips";
import { PersonPrimaryAction } from "@/components/PersonPrimaryAction";
import { ScreenState } from "@/components/ScreenState";
import { fetchMyActivityIds } from "@/data/activities";
import { fetchPerson, type Person } from "@/data/people";
import { useLocation } from "@/providers/location";
import { useProfile } from "@/providers/profile";
import { colors, fontSize, space } from "@/theme";
import { firstName, formatPersonMeta } from "@/utils/person-format";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import { Host, Icon } from "@expo/ui";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// Fiche détail d'une personne (poussée depuis Browse). La RPC get_person ne renvoie
// jamais de coordonnées — uniquement l'âge, une distance grossière, la bio et les
// intérêts. La ville est la mienne (matching intra-ville) -> lue du LocationProvider.
// L'action principale dépend du « tour » de l'invitation active (cf. PersonPrimaryAction).
type Status = "loading" | "error" | "notfound" | "ready";

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

  // Ouvre le chat de notre conversation (= on est matchés).
  function onOpenChat() {
    if (!person?.conversation_id) return;
    router.push(`/chat/${person.conversation_id}`);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: person?.display_name ?? "Profile" }} />

      <ScreenState
        status={status}
        errorText="Couldn’t load this profile."
        onRetry={onRetry}
        notFoundTitle="Profile unavailable"
        notFoundText="This person isn’t available right now."
      />

      {status === "ready" && person ? (
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
                {formatPersonMeta(city?.cityName, person.age, person.distance_m)}
              </Text>
            </View>
          </View>

          <PersonPrimaryAction
            person={person}
            onInvite={onInvite}
            onOpenInvitation={onOpenInvitation}
            onOpenChat={onOpenChat}
          />

          {person.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                About {firstName(person.display_name)}
              </Text>
              <ExpandableBio text={person.bio} />
            </View>
          ) : null}

          {person.activity_names.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <InterestChips
                activityIds={person.activity_ids}
                activityNames={person.activity_names}
                myActivityIds={myActivityIds}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, gap: space.xl },
  headerBlock: { alignItems: "center", gap: space.sm },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
  section: { gap: space.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
});
