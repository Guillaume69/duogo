import { FilterButton } from "@/components/ui/FilterButton";
import { PersonRow } from "@/components/person/PersonRow";
import {
  Centered,
  RetryButton,
  StateText,
  StateTitle,
} from "@/components/ui/ScreenState";
import { Segmented } from "@/components/ui/Segmented";
import { useNearbyPeople } from "@/hooks/useNearbyPeople";
import { useFilters } from "@/providers/filters";
import { colors, fontSize, space } from "@/theme";
import { consumeInvitationSent } from "@/utils/invite-events";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
          <StateText>Activities coming soon.</StateText>
        </Centered>
      ) : locStatus === "loading" ? (
        <Centered>
          <ActivityIndicator />
          <StateText>Finding people near you…</StateText>
        </Centered>
      ) : locStatus === "denied" ? (
        <Centered>
          <StateTitle>Location needed</StateTitle>
          <StateText>Enable location to see people around you.</StateText>
          <RetryButton onPress={onRetryLocation} />
        </Centered>
      ) : locStatus === "error" ? (
        <Centered>
          <StateTitle>Couldn’t get your location</StateTitle>
          <StateText>Check your connection and try again.</StateText>
          <RetryButton onPress={onRetryLocation} />
        </Centered>
      ) : locStatus === "outside" ? (
        <Centered>
          <StateTitle>You’re outside our area</StateTitle>
          <StateText>DuoGo isn’t available in your city yet.</StateText>
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
              <StateText>Couldn’t load people.</StateText>
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
                    <StateText>
                      {activeCount > 0
                        ? "No one matches your filters yet."
                        : "No one’s around you yet."}
                    </StateText>
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: space.xl,
  },
  empty: { alignItems: "center", paddingTop: space.xl * 2 },
});
