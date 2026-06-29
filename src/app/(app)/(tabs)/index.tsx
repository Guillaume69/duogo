import { FilterButton } from "@/components/FilterButton";
import { PersonRow } from "@/components/PersonRow";
import { Segmented } from "@/components/Segmented";
import { useFilters } from "@/lib/filters";
import { consumeInvitationSent } from "@/lib/invite-events";
import { useNearbyPeople } from "@/lib/useNearbyPeople";
import { colors, fontSize, radius, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Onglet Explore. Segmented People | Activities (Activities = brique 7, vide).
// Toute l'orchestration (position + chargement + refresh) vit dans `useNearbyPeople` ;
// ici on ne garde que l'onglet courant et le rendu.
type TabKey = "people" | "activities";

export default function ExploreScreen() {
  const router = useRouter();
  const { activeCount } = useFilters();
  const [tab, setTab] = useState<TabKey>("people");
  const {
    locStatus,
    cityName,
    people,
    myActivityIds,
    peopleStatus,
    refreshing,
    onRefresh,
    reloadPeople,
    onRetryLocation,
  } = useNearbyPeople();

  // Au RETOUR sur Explore, on recharge la liste en silence UNIQUEMENT si une invitation
  // vient d'être envoyée (signal one-shot) -> rafraîchit le badge « Invited ». Le retour
  // de la modale Filtre est déjà couvert par l'effet [filters] de useNearbyPeople, donc
  // on ne recharge pas à chaque focus (évite le double-fetch).
  useFocusEffect(
    useCallback(() => {
      if (consumeInvitationSent()) reloadPeople();
    }, [reloadPeople]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Explore</Text>
      <View style={styles.segment}>
        <Segmented
          options={[
            { value: "people", label: "People" },
            { value: "activities", label: "Activities" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "activities" ? (
        <Centered>
          <Text style={styles.muted}>Activities coming soon.</Text>
        </Centered>
      ) : locStatus === "loading" ? (
        <Centered>
          <ActivityIndicator />
          <Text style={styles.muted}>Finding people near you…</Text>
        </Centered>
      ) : locStatus === "denied" ? (
        <Centered>
          <Text style={styles.title}>Location needed</Text>
          <Text style={styles.muted}>
            Enable location to see people around you.
          </Text>
          <RetryButton onPress={onRetryLocation} />
        </Centered>
      ) : locStatus === "error" ? (
        <Centered>
          <Text style={styles.title}>Couldn’t get your location</Text>
          <Text style={styles.muted}>
            Check your connection and try again.
          </Text>
          <RetryButton onPress={onRetryLocation} />
        </Centered>
      ) : locStatus === "outside" ? (
        <Centered>
          <Text style={styles.title}>You’re outside our area</Text>
          <Text style={styles.muted}>
            DuoGo isn’t available in your city yet.
          </Text>
        </Centered>
      ) : (
        <View style={styles.flex}>
          <View style={styles.subheaderRow}>
            <Text style={styles.subheader}>Recommended People</Text>
            <FilterButton
              count={activeCount}
              onPress={() => router.push("/filter")}
            />
          </View>
          {peopleStatus === "error" ? (
            <Centered>
              <Text style={styles.muted}>Couldn’t load people.</Text>
              <RetryButton onPress={onRefresh} />
            </Centered>
          ) : (
            <FlashList
              data={people}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <PersonRow
                  person={item}
                  cityName={cityName}
                  myActivityIds={myActivityIds}
                  onPress={() => router.push(`/person/${item.id}`)}
                />
              )}
              ItemSeparatorComponent={Separator}
              refreshing={refreshing}
              onRefresh={onRefresh}
              ListEmptyComponent={
                <View style={styles.empty}>
                  {peopleStatus === "loading" ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={styles.muted}>
                      {activeCount > 0
                        ? "No one matches your filters yet."
                        : "No one’s around you yet."}
                    </Text>
                  )}
                </View>
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function Centered({ children }: PropsWithChildren) {
  return <View style={styles.centered}>{children}</View>;
}

function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.retry} onPress={onPress}>
      <Text style={styles.retryText}>Try again</Text>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  segment: { paddingHorizontal: space.xl, paddingVertical: space.md },
  subheaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  subheader: {
    fontSize: fontSize.sub,
    fontWeight: "600",
    color: colors.textMuted,
  },
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: space.xl,
  },
  empty: { alignItems: "center", paddingTop: space.xl * 2 },
});
