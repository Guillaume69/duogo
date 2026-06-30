import { InvitationRow } from "@/components/InvitationRow";
import { useInbox } from "@/hooks/useInbox";
import { colors, fontSize, radius, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

// Écran « Invitation Sent » (poussé depuis l'Inbox). Liste les invitations ENVOYÉES avec
// leur statut. Tap -> détail (lecture seule tant que c'est à l'autre de répondre ; si
// l'autre a demandé des changements, c'est redevenu mon tour -> actions disponibles).
export default function SentInvitationsScreen() {
  const router = useRouter();
  const { status, invitations, refreshing, onRefresh, reload } = useInbox();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const sent = invitations.filter((i) => i.direction === "outgoing");

  return (
    <View style={styles.container}>
      {status === "loading" ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : status === "error" ? (
        <Centered>
          <Text style={styles.muted}>Couldn’t load your invitations.</Text>
          <Pressable style={styles.retry} onPress={onRefresh}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </Centered>
      ) : (
        <FlashList
          data={sent}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <InvitationRow
              invitation={item}
              onPress={() => router.push(`/invitation/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={Separator}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>You haven’t sent any invitations yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function Centered({ children }: PropsWithChildren) {
  return <View style={styles.centered}>{children}</View>;
}

function Separator() {
  return <View style={styles.separator} />;
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
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
  retry: {
    marginTop: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
  },
  retryText: { fontSize: fontSize.body, fontWeight: "600", color: colors.textOnDark },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: space.xl,
  },
  empty: { alignItems: "center", paddingTop: space.xl * 2 },
});
