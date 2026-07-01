import { Avatar } from "@/components/Avatar";
import { ChatComposer } from "@/components/ChatComposer";
import { ChatPinnedInvitation } from "@/components/ChatPinnedInvitation";
import { MessageBubble } from "@/components/MessageBubble";
import {
  getConversation,
  type ConversationDetail,
  type Message,
} from "@/data/conversations";
import { useChat } from "@/hooks/useChat";
import { useProfile } from "@/providers/profile";
import { colors, fontSize, radius, space } from "@/theme";
import { formatDayLabel, isSameLocalDay } from "@/utils/datetime";
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from "react-native";
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Écran de chat d'une conversation (= match). Carte d'invitation épinglée en tête du fil,
// messages en ordre chronologique (rendu depuis le bas, idiome chat de FlashList v2),
// composer en bas, temps réel via useChat (abonnement Realtime + cleanup).
type DetailStatus = "loading" | "error" | "notfound" | "ready";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const myId = profile?.id ?? null;

  // Hauteur PLEINE mesurée du composer (barre absolue, safe-area incluse). SharedValue lue
  // frame-par-frame par KeyboardChatScrollView : réserve cette place en bas du fil pour que le
  // dernier message ne passe jamais sous le composer, clavier ouvert comme fermé.
  const composerHeight = useSharedValue(0);
  const onComposerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // onLayout tourne sur le thread JS : muter la SharedValue est le pattern reanimated
      // standard (pas de runOnJS). La règle immutability est un faux positif ici.
      // eslint-disable-next-line react-hooks/immutability
      composerHeight.value = e.nativeEvent.layout.height;
    },
    [composerHeight],
  );

  // La ScrollView interne de la FlashList devient une KeyboardChatScrollView : elle étend la
  // zone scrollable frame-par-frame (contentInset), SANS passe de layout -> la liste et le
  // composer suivent le clavier sur la MÊME timeline UI-thread (fin du snap/lag). Invariant :
  // offset == KeyboardStickyView.opened == insets.bottom (le fil ne se décale que de
  // keyboardHeight - insets.bottom, donc pas de gap au-dessus du clavier). useCallback à réfs
  // stables -> pas de remount de la ScrollView = pas de saut de scroll. FlashList v2 injecte le
  // ref DANS props -> le spread le transmet (zéro `as`).
  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => (
      <KeyboardChatScrollView
        {...props}
        offset={insets.bottom}
        extraContentPadding={composerHeight}
        keyboardLiftBehavior="always"
      />
    ),
    [insets.bottom, composerHeight],
  );

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("loading");
  // Permet de relancer le chargement de l'en-tête depuis l'écran d'erreur.
  const [reloadKey, setReloadKey] = useState(0);

  // Messages + envoi + temps réel (l'abonnement vit tant que l'écran est monté).
  const {
    messages,
    status: msgStatus,
    send,
    reload: reloadMessages,
  } = useChat(id ?? "", myId);

  // En-tête (autre membre + invitation épinglée). Chargé une fois (statique).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await getConversation(id);
        if (cancelled) return;
        setDetail(d);
        setDetailStatus(d ? "ready" : "notfound");
      } catch {
        if (!cancelled) setDetailStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  function onRetry() {
    setDetailStatus("loading");
    setReloadKey((k) => k + 1);
  }

  // Séparateur de jour : visible au-dessus du 1er message d'un jour différent du précédent.
  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = index > 0 ? messages[index - 1] : null;
      const showDay =
        !prev || !isSameLocalDay(prev.created_at, item.created_at);
      return (
        <View style={styles.item}>
          {showDay ? (
            <Text style={styles.dayLabel}>{formatDayLabel(item.created_at)}</Text>
          ) : null}
          <MessageBubble message={item} mine={item.sender_id === myId} />
        </View>
      );
    },
    [messages, myId],
  );

  // !id => route invalide -> « indisponible » (dérivé, sans setState synchrone en effet).
  const status: DetailStatus = !id ? "notfound" : detailStatus;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () =>
            detail ? (
              <View style={styles.headerTitle}>
                <Avatar
                  path={detail.other_avatar_path}
                  size={30}
                  label={detail.other_name}
                />
                <Text style={styles.headerName} numberOfLines={1}>
                  {detail.other_name}
                </Text>
              </View>
            ) : (
              <Text style={styles.headerName}>Chat</Text>
            ),
        }}
      />

      {status === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : status === "error" ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Couldn’t load this conversation.</Text>
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : status === "notfound" || !detail ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Conversation unavailable</Text>
          <Text style={styles.muted}>This conversation isn’t available anymore.</Text>
        </View>
      ) : (
        // Pattern officiel « Building a chat app » de keyboard-controller (la doc déconseille
        // explicitement KeyboardAvoidingView/KeyboardAwareScrollView pour un chat : frame drops).
        // - Liste : FlashList dont la ScrollView interne EST une KeyboardChatScrollView
        //   (via renderScrollComponent) -> suit le clavier frame-par-frame, sans passe de layout.
        // - Composer : KeyboardStickyView absolu en bas, translaté en Y avec le clavier.
        //   offset.opened = insets.bottom absorbe la safe-area à l'ouverture (pas de gap).
        // Une SEULE valeur clavier animée (UI-thread) pilote liste + composer -> plus de snap
        // à la fermeture ni de lag des messages à l'ouverture.
        <View style={styles.flex}>
          <FlashList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            renderScrollComponent={renderScrollComponent}
            ListHeaderComponent={
              <ChatPinnedInvitation
                detail={detail}
                onPress={() => router.push(`/invitation/${detail.invitation_id}`)}
              />
            }
            contentContainerStyle={styles.listContent}
            maintainVisibleContentPosition={{
              startRenderingFromBottom: true,
              autoscrollToBottomThreshold: 0.2,
            }}
            ListFooterComponent={
              msgStatus === "error" ? (
                <View style={styles.loadErrorBox}>
                  <Text style={styles.loadError}>Couldn’t load messages.</Text>
                  <Pressable style={styles.retry} onPress={reloadMessages}>
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
          <KeyboardStickyView
            offset={{ closed: 0, opened: insets.bottom }}
            style={styles.composerHost}
          >
            <ChatComposer
              onSend={send}
              bottomInset={insets.bottom}
              onLayout={onComposerLayout}
            />
          </KeyboardStickyView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  // Composer collé en bas, superposé à la liste ; le KeyboardStickyView le remonte avec le clavier.
  composerHost: { position: "absolute", left: 0, right: 0, bottom: 0 },
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
  retryText: { fontSize: fontSize.body, fontWeight: "600", color: colors.textOnDark },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  headerName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  listContent: { paddingTop: space.lg, paddingBottom: space.sm },
  item: { marginTop: space.xs },
  dayLabel: {
    alignSelf: "center",
    fontSize: fontSize.label,
    color: colors.textMuted,
    paddingVertical: space.sm,
  },
  loadErrorBox: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
  loadError: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: fontSize.hint,
  },
});
