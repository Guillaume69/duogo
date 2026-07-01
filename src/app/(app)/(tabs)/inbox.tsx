import { ConversationRow } from "@/components/ConversationRow";
import { InvitationRow } from "@/components/InvitationRow";
import { Segmented } from "@/components/Segmented";
import { useConversations } from "@/hooks/useConversations";
import { useInbox } from "@/hooks/useInbox";
import { colors, fontSize, radius, space } from "@/theme";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Onglet Inbox. Deux segments (cf. maquette) : « Chats » (conversations = matchs, en
// principal) et « Invitations » (reçues + actionnables). Lien « Sent » vers les envoyées.
// Le segment actif se (re)charge au focus de l'onglet ET au changement de segment (le
// callback de useFocusEffect dépend de `segment`, donc il est rejoué quand il change).
type Segment = "chats" | "invitations";

export default function InboxScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("chats");

  const {
    status: convStatus,
    conversations,
    refreshing: convRefreshing,
    onRefresh: convRefresh,
    reload: convReload,
  } = useConversations();
  const {
    status: invStatus,
    invitations,
    refreshing: invRefreshing,
    onRefresh: invRefresh,
    reload: invReload,
  } = useInbox();

  useFocusEffect(
    useCallback(() => {
      if (segment === "chats") void convReload();
      else void invReload();
    }, [segment, convReload, invReload]),
  );

  // Invitations en principal = reçues ET tout ce qui attend mon action (une invitation
  // ENVOYÉE renvoyée via Modify revient à moi -> sinon ratée dans « Sent » seulement).
  const received = invitations.filter(
    (i) => i.direction === "incoming" || i.awaiting_me,
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Inbox</Text>
        <Pressable onPress={() => router.push("/sent-invitations")} hitSlop={8}>
          <Text style={styles.link}>Sent</Text>
        </Pressable>
      </View>

      <View style={styles.segmentRow}>
        <Segmented
          options={[
            { value: "chats", label: "Chats" },
            { value: "invitations", label: "Invitations" },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {segment === "chats" ? (
        convStatus === "loading" ? (
          <Centered>
            <ActivityIndicator />
          </Centered>
        ) : convStatus === "error" ? (
          <Centered>
            <Text style={styles.muted}>Couldn’t load your chats.</Text>
            <Pressable style={styles.retry} onPress={convReload}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </Centered>
        ) : (
          <FlashList
            data={conversations}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <ConversationRow
                conversation={item}
                onPress={() => router.push(`/chat/${item.id}`)}
              />
            )}
            ItemSeparatorComponent={Separator}
            refreshing={convRefreshing}
            onRefresh={convRefresh}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.muted}>
                  No chats yet. Accept an invitation to start chatting.
                </Text>
              </View>
            }
          />
        )
      ) : invStatus === "loading" ? (
        <Centered>
          <ActivityIndicator />
        </Centered>
      ) : invStatus === "error" ? (
        <Centered>
          <Text style={styles.muted}>Couldn’t load your invitations.</Text>
          <Pressable style={styles.retry} onPress={invReload}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </Centered>
      ) : (
        <FlashList
          data={received}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <InvitationRow
              invitation={item}
              onPress={() => router.push(`/invitation/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={Separator}
          refreshing={invRefreshing}
          onRefresh={invRefresh}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>No invitations yet.</Text>
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
  },
  header: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
  link: { fontSize: fontSize.body, color: colors.accent, fontWeight: "600" },
  segmentRow: { paddingHorizontal: space.xl, paddingVertical: space.md },
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
