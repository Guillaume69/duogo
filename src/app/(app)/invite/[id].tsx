import { DatePickerRow } from "@/components/DatePickerRow";
import { FieldLabel } from "@/components/FieldLabel";
import { InviteTimeField } from "@/components/InviteTimeField";
import { PickerField, type PickerOption } from "@/components/PickerField";
import { fetchActivities, type Activity } from "@/data/activities";
import { findNearbyLocations, type NearbyLocation } from "@/data/locations";
import { formatDateDisplay } from "@/lib/datetime";
import { InviteDraftProvider, useInviteDraft } from "@/lib/invite-draft";
import { firstName, formatDistance } from "@/lib/person-format";
import { colors, fontSize, radius, space } from "@/theme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Flux modal « Invite to Activity ». Le brouillon (activité, date, heure, lieu, message)
// vit dans InviteDraftProvider ; cet écran ne fait que câbler les champs natifs et lancer
// l'envoi. Poussé depuis la fiche personne avec ?name= pour le titre (évite un fetch).
export default function InviteScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  // Garde param manquant (lien direct malformé) : pas d'écran d'invitation sans cible.
  if (!id) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "New invitation" }} />
        <Text style={styles.muted}>This person isn’t available right now.</Text>
      </View>
    );
  }

  return (
    <InviteDraftProvider recipientId={id}>
      <InviteCompose recipientName={name} />
    </InviteDraftProvider>
  );
}

function InviteCompose({ recipientName }: { recipientName?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useInviteDraft();

  // Catalogue d'activités (requis) + lieux proches (facultatif), chacun avec son
  // chargement/erreur/retry — un échec de l'un n'empêche pas l'autre.
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState(false);

  // Lieux : chargés UNIQUEMENT après le choix d'une activité (filtrés par activité) ->
  // loading démarre à false, le picker lieu est désactivé tant qu'aucune activité.
  const [locations, setLocations] = useState<NearbyLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(false);
  // Garde de séquence : en cas de changement rapide d'activité, seul le dernier
  // chargement applique son résultat (pas d'écrasement par une réponse périmée).
  const locReqRef = useRef(0);

  // loadActivities : AUCUN setState synchrone (état dans les callbacks de promesse) ->
  // appelable depuis un effet sans cascade. Le retour à « loading » d'un retry se fait
  // dans le handler d'event (retry*), pas ici.
  const loadActivities = useCallback(() => {
    fetchActivities()
      .then((a) => {
        setActivities(a);
        setActivitiesError(false);
      })
      .catch(() => setActivitiesError(true))
      .finally(() => setActivitiesLoading(false));
  }, []);

  // Lieux FILTRÉS par l'activité choisie (gardé par locReqRef contre les réponses périmées).
  const loadLocationsFor = useCallback((activityId: string) => {
    const ticket = ++locReqRef.current;
    findNearbyLocations(activityId)
      .then((l) => {
        if (locReqRef.current !== ticket) return;
        setLocations(l);
        setLocationsError(false);
      })
      .catch(() => {
        if (locReqRef.current === ticket) setLocationsError(true);
      })
      .finally(() => {
        if (locReqRef.current === ticket) setLocationsLoading(false);
      });
  }, []);

  // Sélection d'activité : MAJ du brouillon (réinitialise lieu + erreur) puis (re)charge
  // les lieux de cette activité. setState synchrone OK (handler d'event, hors effet).
  const onSelectActivity = useCallback(
    (activityId: string) => {
      draft.setActivityId(activityId);
      setLocations([]);
      setLocationsError(false);
      setLocationsLoading(true);
      loadLocationsFor(activityId);
    },
    [draft, loadLocationsFor],
  );

  const retryActivities = useCallback(() => {
    setActivitiesError(false);
    setActivitiesLoading(true);
    loadActivities();
  }, [loadActivities]);

  const retryLocations = useCallback(() => {
    if (!draft.activityId) return;
    setLocationsError(false);
    setLocationsLoading(true);
    loadLocationsFor(draft.activityId);
  }, [draft.activityId, loadLocationsFor]);

  // Catalogue d'activités au montage ; les lieux attendent le choix d'une activité.
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const activityOptions: PickerOption[] = activities.map((a) => ({
    id: a.id,
    title: a.name,
  }));
  const locationOptions: PickerOption[] = locations.map((l) => ({
    id: l.id,
    title: l.name,
    subtitle: [l.address, formatDistance(l.distance_m)]
      .filter(Boolean)
      .join("  ·  "),
  }));

  async function onSend() {
    const ok = await draft.submit();
    if (ok) router.back();
  }

  const title = recipientName
    ? `Invite ${firstName(recipientName)}`
    : "New invitation";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <FieldLabel>ACTIVITY</FieldLabel>
        <PickerField
          placeholder="Choose an activity"
          sheetTitle="Choose an activity"
          options={activityOptions}
          selectedId={draft.activityId}
          onSelect={onSelectActivity}
          loading={activitiesLoading}
          error={activitiesError}
          onRetry={retryActivities}
        />

        <FieldLabel>DATE</FieldLabel>
        <DatePickerRow
          value={draft.date}
          onChange={draft.setDate}
          placeholder="Pick a date"
          format={formatDateDisplay}
          initialDate={draft.minDate}
          minimumDate={draft.minDate}
        />

        <FieldLabel>TIME (OPTIONAL)</FieldLabel>
        <InviteTimeField
          slot={draft.timeSlot}
          time={draft.time}
          onSlot={draft.setSlot}
          onPickTime={draft.setTime}
          onClear={draft.clearTime}
        />

        <FieldLabel>PLACE (OPTIONAL)</FieldLabel>
        <PickerField
          // Lieu désactivé tant qu'aucune activité (les lieux sont filtrés par activité).
          placeholder={draft.activityId ? "Add a place" : "Choose an activity first"}
          sheetTitle="Choose a place"
          options={locationOptions}
          selectedId={draft.locationId}
          onSelect={draft.setLocationId}
          loading={locationsLoading}
          error={locationsError}
          onRetry={retryLocations}
          noneLabel="No specific place"
          onClear={() => draft.setLocationId(null)}
          disabled={!draft.activityId}
        />

        <FieldLabel>MESSAGE (OPTIONAL)</FieldLabel>
        <TextInput
          style={[styles.input, styles.message]}
          value={draft.message}
          onChangeText={draft.setMessage}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {draft.error && <Text style={styles.error}>{draft.error}</Text>}
        <Pressable
          style={[styles.sendBtn, !draft.canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!draft.canSend}
        >
          <Text style={styles.sendText}>
            {draft.sending ? "Sending…" : "Send invitation"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, gap: 6, paddingBottom: space.xl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.surface,
  },
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  message: { minHeight: 96 },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: space.sm,
  },
  error: { color: colors.danger, fontSize: fontSize.hint },
  sendBtn: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
  sendText: {
    color: colors.textOnDark,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
});
