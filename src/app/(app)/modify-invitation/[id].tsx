import { InviteForm } from "@/components/invitation/InviteForm";
import { getInvitation } from "@/data/invitations";
import {
  InviteDraftProvider,
  type InviteInitial,
} from "@/providers/invite-draft";
import { colors, fontSize, space } from "@/theme";
import { parseLocalDate, parseLocalTime } from "@/utils/datetime";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

// Écran Modify (contre-proposition), en modale. On RÉCUPÈRE l'invitation pour pré-remplir
// le brouillon, puis on réutilise le formulaire partagé (InviteForm) en mode « modify ».
// Seul le membre dont c'est le tour peut modifier (sinon « unavailable » + la RPC refuse).
type Status = "loading" | "error" | "unavailable" | "ready";

export default function ModifyInvitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [initial, setInitial] = useState<InviteInitial | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setStatus("unavailable");
        return;
      }
      try {
        const d = await getInvitation(id);
        if (cancelled) return;
        const canModify =
          d !== null &&
          d.awaiting_me &&
          (d.status === "pending" || d.status === "changes_requested");
        if (!d || !canModify) {
          setStatus("unavailable");
          return;
        }
        setInitial({
          activityId: d.activity_id,
          date: parseLocalDate(d.scheduled_date),
          timeSlot: d.time_slot,
          time: d.scheduled_time ? parseLocalTime(d.scheduled_time) : null,
          locationId: d.location_id,
          message: d.message ?? "",
        });
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "ready" && id && initial) {
    return (
      <InviteDraftProvider
        config={{ mode: "modify", invitationId: id, initial }}
      >
        <Stack.Screen options={{ title: "Modify invitation" }} />
        <InviteForm submitLabel="Save changes" submittingLabel="Saving…" />
      </InviteDraftProvider>
    );
  }

  return (
    <View style={styles.centered}>
      <Stack.Screen options={{ title: "Modify invitation" }} />
      {status === "loading" ? (
        <ActivityIndicator />
      ) : status === "error" ? (
        <Text style={styles.muted}>Couldn’t load this invitation.</Text>
      ) : (
        <Text style={styles.muted}>This invitation can’t be modified right now.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.surface,
  },
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
});
