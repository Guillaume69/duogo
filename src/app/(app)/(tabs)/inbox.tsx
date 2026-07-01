import { InboxRow } from "@/components/InboxRow";
import { useInboxFeed } from "@/hooks/useInboxFeed";
import { useInboxBadge } from "@/providers/inbox-badge";
import { colors, fontSize, radius, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Onglet Inbox — flux UNIFIÉ (brique 6.5) : une ligne par personne, matchs et invitations qui
// m'attendent mêlés, triés « mon tour d'abord puis récence » (cf. get_inbox). Fini les 3 endroits
// (chats / invitations / sent) et la frontière incoming/outgoing bancale : l'axe est « ça m'attend
// ou pas » (badge « Your Turn »). Le lien « Sent » ouvre la file d'attente des invitations où
// j'attends l'AUTRE. Au focus : on recharge la liste ET on rafraîchit le compteur du badge.
export default function InboxScreen() {
  const router = useRouter();
  const { status, items, refreshing, onRefresh, reload } = useInboxFeed();
  const { setCount } = useInboxBadge();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Le badge se DÉRIVE de la liste déjà chargée (compteur d'attention = nb de lignes needs_me) :
  // pas de 2e RPC quand l'Inbox est montée (get_inbox_count ré-exécute tout le flux). Le provider
  // garde son propre fetch pour les cas où la liste n'est pas montée (montage / retour au 1er plan).
  useEffect(() => {
    if (status === "ready") setCount(items.filter((i) => i.needs_me).length);
  }, [items, status, setCount]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Inbox</Text>
        <Pressable onPress={() => router.push("/sent-invitations")} hitSlop={8}>
          <Text style={styles.link}>Sent</Text>
        </Pressable>
      </View>

      {status === "loading" ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : status === "error" ? (
        <Centered>
          <Text style={styles.muted}>Couldn’t load your inbox.</Text>
          <Pressable style={styles.retry} onPress={reload}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </Centered>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => `${i.kind}:${i.target_id}`}
          renderItem={({ item }) => (
            <InboxRow
              item={item}
              onPress={() =>
                router.push(
                  item.kind === "conversation"
                    ? `/chat/${item.target_id}`
                    : `/invitation/${item.target_id}`,
                )
              }
            />
          )}
          ItemSeparatorComponent={Separator}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>
                Nothing here yet. Invite someone to an activity to get started.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  header: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
  link: { fontSize: fontSize.body, color: colors.accent, fontWeight: "600" },
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
