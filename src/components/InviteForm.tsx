import { DatePickerRow } from "@/components/DatePickerRow";
import { FieldLabel } from "@/components/FieldLabel";
import { InviteTimeField } from "@/components/InviteTimeField";
import { PickerField, type PickerOption } from "@/components/PickerField";
import { fetchActivities, type Activity } from "@/data/activities";
import { findNearbyLocations, type NearbyLocation } from "@/data/locations";
import { useInviteDraft } from "@/providers/invite-draft";
import { colors, fontSize, radius, space } from "@/theme";
import { formatDateDisplay } from "@/utils/datetime";
import { formatDistance } from "@/utils/person-format";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Formulaire d'invitation, partagé entre la CRÉATION (invite/[id]) et la MODIFY
// (modify-invitation/[id]). Le brouillon (activité, date, heure, lieu, message) vit dans
// InviteDraftProvider ; ce composant câble les champs natifs et déclenche submit. Au
// succès, il ferme l'écran (router.back). Les libellés du bouton dépendent du mode.
type Props = {
  submitLabel: string;
  submittingLabel: string;
};

export function InviteForm({ submitLabel, submittingLabel }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useInviteDraft();

  // Catalogue d'activités (requis) + lieux proches (facultatif), chacun avec son
  // chargement/erreur/retry — un échec de l'un n'empêche pas l'autre.
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState(false);

  const [locations, setLocations] = useState<NearbyLocation[]>([]);
  // Pré-rempli (modify) -> on démarre en chargement (les lieux de l'activité initiale se
  // chargent au montage) ; en création (pas d'activité) -> pas de chargement.
  const [locationsLoading, setLocationsLoading] = useState(
    () => draft.activityId !== null,
  );
  const [locationsError, setLocationsError] = useState(false);
  // Garde de séquence : en cas de changement rapide d'activité, seul le dernier
  // chargement applique son résultat (pas d'écrasement par une réponse périmée).
  const locReqRef = useRef(0);

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

  // Catalogue d'activités au montage.
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // PRÉ-REMPLISSAGE (modify) : charge UNE fois au montage les lieux de l'activité déjà
  // choisie. La garde par ref évite de recharger sur changement (géré par onSelectActivity)
  // et garde l'effet SANS setState synchrone (lint react-hooks/set-state-in-effect) :
  // loadLocationsFor ne fait que des setState asynchrones (callbacks de promesse).
  const didInitLocations = useRef(false);
  useEffect(() => {
    if (didInitLocations.current) return;
    didInitLocations.current = true;
    if (draft.activityId) loadLocationsFor(draft.activityId);
  }, [draft.activityId, loadLocationsFor]);

  // Sélection d'activité (handler d'event -> reset synchrone autorisé, hors effet) : met à
  // jour le brouillon (qui réinitialise le lieu) puis (re)charge les lieux de l'activité.
  const onSelectActivity = useCallback(
    (id: string) => {
      if (id === draft.activityId) return; // même activité -> ne rien refaire
      draft.setActivityId(id);
      setLocations([]);
      setLocationsError(false);
      setLocationsLoading(true);
      loadLocationsFor(id);
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

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={62}
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
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {draft.error && <Text style={styles.error}>{draft.error}</Text>}
        <Pressable
          style={[styles.sendBtn, !draft.canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!draft.canSend}
        >
          <Text style={styles.sendText}>
            {draft.sending ? submittingLabel : submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, gap: 6, paddingBottom: space.xl },
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
