import { InvitationRow } from "@/components/invitation/InvitationRow";
import { ScreenState, StateText } from "@/components/ui/ScreenState";
import { useInbox } from "@/hooks/useInbox";
import { colors, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

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
      <ScreenState
        status={status}
        errorText="Couldn’t load your invitations."
        onRetry={onRefresh}
      />

      {status === "ready" ? (
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
              <StateText>
                No pending invitations. When you invite someone, it shows here
                while you wait for their reply.
              </StateText>
            </View>
          }
        />
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginLeft: space.xl,
  },
  empty: { alignItems: "center", paddingTop: space.xl * 2 },
});
