import { Avatar } from "@/components/Avatar";
import { InvitationCard } from "@/components/InvitationCard";
import {
  getInvitation,
  isInvitationConflictError,
  isInvitationNotFoundError,
  respondInvitation,
  type InvitationDetail,
} from "@/data/invitations";
import { colors, fontSize, radius, space } from "@/theme";
import { markInvitationSent } from "@/utils/invite-events";
import { firstName, formatDistance } from "@/utils/person-format";
import LocationIcon from "@expo/material-symbols/location_on.xml";
import { Host, Icon } from "@expo/ui";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Détail d'une invitation (poussé depuis l'Inbox ou un futur deep-link). Affiche le
// récapitulatif (carte) ; si c'est MON tour de répondre (awaiting_me + état actif), les
// actions Accept / Modify / Decline apparaissent — sinon lecture seule (en attente,
// acceptée ou refusée). respond_invitation crée la conversation à l'acceptation.
type Status = "loading" | "error" | "notfound" | "ready";

export default function InvitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<InvitationDetail | null>(null);
  const loadedOnceRef = useRef(false);

  // Anti double-tap synchrone + état d'envoi pour griser les actions pendant la réponse.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const doLoad = useCallback(
    async (signal: { cancelled: boolean }) => {
      if (!loadedOnceRef.current) setStatus("loading");
      let d: InvitationDetail | null;
      try {
        d = id ? await getInvitation(id) : null;
      } catch {
        if (!signal.cancelled && !loadedOnceRef.current) setStatus("error");
        return;
      }
      if (signal.cancelled) return;
      if (!d) {
        if (!loadedOnceRef.current) setStatus("notfound");
        return;
      }
      setDetail(d);
      setStatus("ready");
      loadedOnceRef.current = true;
    },
    [id],
  );

  // Rejoué à chaque focus : au retour de l'écran Modify, le détail relit l'état (passé
  // en changes_requested / tour de l'autre) sans action manuelle.
  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      doLoad(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [doLoad]),
  );

  function onRetry() {
    loadedOnceRef.current = false;
    doLoad({ cancelled: false });
  }

  const respond = useCallback(
    async (accept: boolean) => {
      if (!id || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setActionError(null);
      try {
        await respondInvitation({ invitationId: id, accept });
        // Rafraîchit les badges d'Explore au prochain focus ; l'Inbox recharge au retour.
        markInvitationSent();
        router.back();
      } catch (e) {
        setActionError(
          isInvitationConflictError(e)
            ? "This invitation can no longer be answered."
            : isInvitationNotFoundError(e)
              ? "This invitation no longer exists."
              : "Something went wrong. Please try again.",
        );
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [id, router],
  );

  function onModify() {
    if (!id) return;
    router.push(`/modify-invitation/${id}`);
  }

  // C'est mon tour ET l'invitation est encore active -> actions disponibles.
  const canAct =
    detail !== null &&
    detail.awaiting_me &&
    (detail.status === "pending" || detail.status === "changes_requested");

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: detail?.other_name ?? "Invitation" }} />

      {status === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : status === "error" ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Couldn’t load this invitation.</Text>
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : status === "notfound" || !detail ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Invitation unavailable</Text>
          <Text style={styles.muted}>This invitation isn’t available anymore.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.headerBlock}>
              <Avatar
                path={detail.other_avatar_path}
                size={96}
                label={detail.other_name}
              />
              <Text style={styles.name}>{detail.other_name}</Text>
              <Text style={styles.subtitle}>{subtitleFor(detail)}</Text>
              {metaFor(detail) ? (
                <View style={styles.metaRow}>
                  <Host matchContents>
                    <Icon
                      name={{ ios: "mappin", android: LocationIcon }}
                      size={16}
                      color={colors.textMeta}
                    />
                  </Host>
                  <Text style={styles.meta}>{metaFor(detail)}</Text>
                </View>
              ) : null}
            </View>

            <InvitationCard detail={detail} />
          </ScrollView>

          {canAct ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
              {actionError ? (
                <Text style={styles.error}>{actionError}</Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={styles.action}
                  onPress={() => respond(true)}
                  disabled={submitting}
                >
                  <Text style={[styles.actionText, styles.accept]}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={onModify}
                  disabled={submitting}
                >
                  <Text style={[styles.actionText, styles.modify]}>Modify</Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={() => respond(false)}
                  disabled={submitting}
                >
                  <Text style={[styles.actionText, styles.decline]}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

// Sous-titre selon l'état + le sens. firstName pour un ton personnel.
function subtitleFor(d: InvitationDetail): string {
  const fn = firstName(d.other_name);
  if (d.status === "accepted") return "You’re matched 🎉";
  if (d.status === "declined")
    return d.direction === "incoming"
      ? "You declined this invitation"
      : `${fn} declined`;
  if (d.awaiting_me)
    return d.status === "changes_requested"
      ? `${fn} suggested changes`
      : "Sent you an invitation";
  return `Waiting for ${fn}…`;
}

// Ville · distance grossière de l'autre personne (jamais de coordonnées).
function metaFor(d: InvitationDetail): string {
  return [
    d.other_city_name,
    d.other_distance_m !== null ? formatDistance(d.other_distance_m) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
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
  scroll: { padding: space.xl, gap: space.xl },
  headerBlock: { alignItems: "center", gap: space.sm },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  subtitle: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: space.sm,
  },
  error: { color: colors.danger, fontSize: fontSize.hint, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "space-between" },
  action: { flex: 1, alignItems: "center", paddingVertical: space.sm },
  actionText: { fontSize: fontSize.body, fontWeight: "600" },
  accept: { color: colors.accent },
  modify: { color: colors.accent },
  decline: { color: colors.danger },
});
