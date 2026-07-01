import { Avatar } from "@/components/ui/Avatar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatPinnedInvitation } from "@/components/chat/ChatPinnedInvitation";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  getConversation,
  type ConversationDetail,
} from "@/data/conversations";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useProfile } from "@/providers/profile";
import { colors, fontSize, radius, space } from "@/theme";
import { formatDayLabel, isSameLocalDay } from "@/utils/datetime";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Écran de chat d'une conversation (= match). Deux idiomes combinés :
//  1. Liste INVERSÉE (idiome chat) : le message le plus récent est à l'offset natif 0 = le bas de
//     l'écran. Conséquence : l'écran s'ouvre calé en bas SANS aucune correction de scroll (donc plus
//     de snap), et un nouveau message reste collé en bas.
//  2. Composer DANS LE FLUX (pas d'overlay absolu) : la liste `flex:1` est bornée par le haut du
//     composer, donc le dernier message est toujours juste au-dessus de lui — sans spacer ni inset à
//     réserver (l'ancien spacer JS partait de 0 -> course au 1er paint, donc « parfois en dessous »).
//     Quand le composer grandit/rétrécit (multiligne), la liste suit dans la MÊME passe de layout :
//     pas de saut en deux temps.
// Le suivi du clavier est piloté par un `paddingBottom` animé sur le conteneur, dérivé DIRECTEMENT
// de la SharedValue clavier (`useReanimatedKeyboardAnimation().height`, frame-par-frame). On rétrécit
// le conteneur par le bas -> le composer monte et la liste inversée garde le récent collé au-dessus.
// On a écarté `KeyboardAvoidingView` : sa version `automaticOffset` détecte sa position à l'écran
// (viewPositionInWindow, async) et ce calcul RATAIT par moments -> le clavier recouvrait l'input.
// La valeur clavier, elle, est déterministe (aucune mesure de frame). `height` est négatif à
// l'ouverture ; le conteneur touche le bas de l'écran donc `-height` = hauteur clavier suffit,
// header natif indifférent. On retire `insets.bottom` (le composer la porte déjà au repos) pour
// coller au clavier sans gap. L'inversion retourne l'ordre visuel -> la carte d'invitation épinglée
// (tête du fil) est un ListFooterComponent. Temps réel via useChat (abonnement Realtime + cleanup).
type DetailStatus = "loading" | "error" | "notfound" | "ready";

// En liste inversée, l'offset natif 0 = le bas visuel (message le plus récent). En-deçà de ce seuil
// (px) on considère que l'utilisateur « est en bas » : un nouveau message y auto-scrolle alors ; au-delà
// (il lit l'historique) on le laisse tranquille (MVCP garde sa position stable).
const NEAR_BOTTOM_PX = 120;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const myId = profile?.id ?? null;

  // Évitement du clavier, déterministe : `height` va de 0 (fermé) à -kbHeight (ouvert). Le conteneur
  // touche le bas de l'écran -> paddingBottom = hauteur clavier lève le composer + la liste au-dessus.
  // On soustrait insets.bottom (déjà porté par le composer au repos) pour ne pas doubler la safe-area
  // clavier ouvert ; clamp >= 0 pour rester neutre clavier fermé. Aucune mesure de frame -> pas de flaky.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const keyboardAvoidStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(-keyboardHeight.value - insets.bottom, 0),
  }));

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<DetailStatus>("loading");
  // Permet de relancer le chargement de l'en-tête depuis l'écran d'erreur.
  const [reloadKey, setReloadKey] = useState(0);

  // Messages + envoi + temps réel (l'abonnement vit tant que l'écran est monté).
  const {
    messages,
    status: msgStatus,
    send,
    retry,
    reload: reloadMessages,
  } = useChat(id ?? "", myId);

  // Liste inversée -> data[0] est au bas visuel. useChat trie du plus ancien au plus récent : on
  // inverse pour mettre le plus RÉCENT en tête (data[0]), donc en bas de l'écran.
  const orderedMessages = useMemo(() => messages.slice().reverse(), [messages]);

  // Auto-scroll en bas quand un message arrive. L'auto-scroll natif de FlashList (autoscrollToBottom
  // -> scrollToEnd) vise la FIN du scroll = le haut visuel en inverted : inutilisable ici. Et MVCP
  // (activé par défaut) ancre l'ancien contenu quand on prepend -> le nouveau passe SOUS la ligne de
  // flottaison. On corrige donc à la main : scrollToOffset(0) (= bas visuel) quand le dernier message
  // change, si c'est le nôtre (on vient de l'envoyer) ou si on est déjà en bas (on ne dérange pas la
  // lecture d'historique). `nearBottom`/`lastMsgId` en refs : pas de re-render sur le scroll.
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const nearBottomRef = useRef(true);
  const lastMsgIdRef = useRef<string | null>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    nearBottomRef.current = e.nativeEvent.contentOffset.y <= NEAR_BOTTOM_PX;
  }, []);

  useEffect(() => {
    const newest = orderedMessages[0];
    if (!newest || lastMsgIdRef.current === newest.id) return;
    // Premier remplissage : la liste inversée cale déjà en bas, ne pas scroller.
    const isFirstFill = lastMsgIdRef.current === null;
    lastMsgIdRef.current = newest.id;
    if (isFirstFill) return;
    if (newest.senderId === myId || nearBottomRef.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [orderedMessages, myId]);

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

  // Séparateur de jour : au sommet de chaque groupe de jour, i.e. au-dessus du message le plus
  // ANCIEN de ce jour. Données en newest-first -> le voisin visuellement au-dessus de
  // orderedMessages[i] est orderedMessages[i+1] (plus ancien). On montre le label quand ce voisin
  // change de jour (ou tout en haut de liste). L'item est contre-inversé par FlashList, donc le
  // label placé au-dessus de la bulle s'affiche bien au-dessus visuellement.
  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const older =
        index < orderedMessages.length - 1 ? orderedMessages[index + 1] : null;
      const showDay =
        !older || !isSameLocalDay(older.createdAt, item.createdAt);
      return (
        <View style={styles.item}>
          {showDay ? (
            <Text style={styles.dayLabel}>{formatDayLabel(item.createdAt)}</Text>
          ) : null}
          <MessageBubble
            item={item}
            mine={item.senderId === myId}
            onRetry={() => retry(item.id)}
          />
        </View>
      );
    },
    [orderedMessages, myId, retry],
  );

  // Footer (haut visuel en liste inversée) = carte d'invitation épinglée. Mémoïsé : sinon
  // l'élément et sa closure onPress seraient recréés à chaque nouveau message (re-render de
  // l'écran) alors que `detail`, chargé une seule fois, est statique.
  const pinnedFooter = useMemo(
    () =>
      detail ? (
        <ChatPinnedInvitation
          detail={detail}
          onPress={() => router.push(`/invitation/${detail.invitation_id}`)}
        />
      ) : null,
    [detail, router],
  );

  // Header (bas visuel) = encart d'erreur de chargement des messages. Mémoïsé de même.
  const loadErrorHeader = useMemo(
    () =>
      msgStatus === "error" ? (
        <View style={styles.loadErrorBox}>
          <Text style={styles.loadError}>Couldn’t load messages.</Text>
          <Pressable style={styles.retry} onPress={reloadMessages}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null,
    [msgStatus, reloadMessages],
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
        // Conteneur flex : la liste inversée prend la place restante au-dessus du composer (dans le
        // flux). Son paddingBottom animé (dérivé du clavier) réduit le conteneur par le bas
        // frame-par-frame -> composer + liste montent ensemble, sans snap ni lag.
        <Animated.View style={[styles.flex, keyboardAvoidStyle]}>
          <FlashList
            ref={listRef}
            inverted
            style={styles.flex}
            data={orderedMessages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            onScroll={onScroll}
            scrollEventThrottle={16}
            // MVCP natif COUPÉ. Activé par défaut, il ancre l'ancien contenu quand on prepend
            // (minIndexForVisible: 0) : le nouveau message passe alors sous la ligne de flottaison,
            // et il recale AU NIVEAU NATIF (avant nos effets JS) -> notre scroll se faisait écraser
            // (aggravé par le double-insert envoi+écho Realtime). Coupé : à l'offset 0 (bas visuel),
            // un prepend laisse l'offset à 0 -> le nouveau message s'affiche en bas de lui-même ;
            // l'effet ci-dessus ne fait plus que snapper au bas quand on était légèrement remonté.
            maintainVisibleContentPosition={{ disabled: true }}
            contentContainerStyle={styles.listContent}
            // Inversion -> l'ordre visuel est retourné : le footer (DOM) s'affiche EN HAUT, le header
            // EN BAS. L'invitation épinglée (haut du fil) est donc un ListFooterComponent ; l'erreur
            // de chargement, qui doit rester près des messages récents (bas), est un ListHeaderComponent.
            ListFooterComponent={pinnedFooter}
            ListHeaderComponent={loadErrorHeader}
          />
          <ChatComposer onSend={send} bottomInset={insets.bottom} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
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
  // Liste inversée : paddingTop rend au bas visuel (sous le message récent, au-dessus du composer),
  // paddingBottom au haut visuel (au-dessus de l'invitation épinglée).
  listContent: { paddingTop: space.sm, paddingBottom: space.lg },
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
