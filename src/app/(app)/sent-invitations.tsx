import { InvitationRow } from "@/components/InvitationRow";
import { useInbox } from "@/hooks/useInbox";
import { colors, fontSize, radius, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

// Écran « Invitation Sent » (poussé depuis l'Inbox) = FILE D'ATTENTE VIVANTE (brique 6.5) :
// les invitations où j'attends L'AUTRE (mon tour est passé, invitation encore active), quel que
// soit le sens d'origine — une invitation reçue puis renvoyée via Modify y figure aussi. Les
// résolues en sortent : acceptée -> chat dans l'Inbox, refusée -> disparaît. Ce qui M'attend, lui,
// vit dans l'Inbox (pas ici). Tap -> détail (lecture seule tant que c'est à l'autre de répondre).
export default function SentInvitationsScreen() {
  const router = useRouter();
  const { status, invitations, refreshing, onRefresh, reload } = useInbox();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // J'attends l'autre (!awaiting_me) ET l'invitation est encore active (pending/changes_requested).
  const waiting = invitations.filter(
    (i) =>
      !i.awaiting_me &&
      (i.status === "pending" || i.status === "changes_requested"),
  );

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
          data={waiting}
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
              <Text style={styles.muted}>
                No pending invitations. When you invite someone, it shows here
                while you wait for their reply.
              </Text>
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
