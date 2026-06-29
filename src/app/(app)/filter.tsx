import { ActivityChips } from "@/components/ActivityChips";
import { fetchActivities, type Activity } from "@/data/activities";
import type { AgeRange } from "@/data/people";
import type { Enums } from "@/lib/database.types";
import { DEFAULT_RADIUS_KM, useFilters } from "@/providers/filters";
import { GENDER_LABELS, GENDER_VALUES } from "@/utils/profile-fields";
import { colors, fontSize, radius, space } from "@/theme";
import { Host, Slider } from "@expo/ui/jetpack-compose";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Tranches d'âge prédéfinies, MULTI-sélection (comme le genre). Rien de coché =
// tous les âges. Un double-slider serait peu pratique ; les chips sont plus claires.
const AGE_PRESETS: { label: string; min: number; max: number | null }[] = [
  { label: "18–25", min: 18, max: 25 },
  { label: "26–35", min: 26, max: 35 },
  { label: "36–45", min: 36, max: 45 },
  { label: "46+", min: 46, max: null },
];

// Sheet « Filter by » (modale). Édite un brouillon LOCAL, applique au FilterProvider
// seulement sur « Apply » (sinon Explore relancerait une requête à chaque réglage).
export default function FilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters, reset } = useFilters();

  const [radiusKm, setRadiusKm] = useState(filters.radiusKm);
  const [genders, setGenders] = useState<Enums<"gender">[]>(filters.genders);
  const [ageRanges, setAgeRanges] = useState<AgeRange[]>(filters.ageRanges);
  const [activityIds, setActivityIds] = useState<string[]>(filters.activityIds);
  const [activities, setActivities] = useState<Activity[]>([]);
  // En échec, on AFFICHE un retry : sinon des filtres d'activités déjà actifs seraient
  // invisibles (pas de chip à décocher) tout en restant appliqués au tap sur Apply.
  const [activitiesError, setActivitiesError] = useState(false);

  // Pas de setState SYNCHRONE ici (sinon cascade de rendus en effet) : on n'écrit
  // l'état que dans les callbacks async (succès efface l'erreur, échec la lève).
  const loadActivities = useCallback(() => {
    fetchActivities()
      .then((a) => {
        setActivities(a);
        setActivitiesError(false);
      })
      .catch(() => setActivitiesError(true));
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  function toggleGender(g: Enums<"gender">) {
    setGenders((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }
  function toggleActivity(id: string) {
    setActivityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleAge(min: number, max: number | null) {
    setAgeRanges((prev) =>
      prev.some((r) => r.min === min && r.max === max)
        ? prev.filter((r) => !(r.min === min && r.max === max))
        : [...prev, { min, max }],
    );
  }

  function onApply() {
    setFilters({ radiusKm, genders, ageRanges, activityIds });
    router.back();
  }
  function onReset() {
    reset();
    router.back();
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>DISTANCE</Text>
        <Text style={styles.value}>
          {radiusKm >= DEFAULT_RADIUS_KM ? "Up to 50 km" : `Within ${radiusKm} km`}
        </Text>
        <Host
          matchContents={{ vertical: true }}
          colorScheme="light"
          style={styles.slider}
        >
          <Slider
            value={radiusKm}
            min={1}
            max={DEFAULT_RADIUS_KM}
            onValueChange={(v) => setRadiusKm(Math.round(v))}
            colors={{
              thumbColor: colors.fillDark,
              activeTrackColor: colors.fillDark,
              inactiveTrackColor: colors.border,
            }}
          />
        </Host>

        <Text style={styles.label}>GENDER</Text>
        <View style={styles.chipRow}>
          {GENDER_VALUES.map((g) => {
            const on = genders.includes(g);
            return (
              <Pressable
                key={g}
                onPress={() => toggleGender(g)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {GENDER_LABELS[g]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>AGE</Text>
        <View style={styles.chipRow}>
          {AGE_PRESETS.map((p) => {
            const on = ageRanges.some(
              (r) => r.min === p.min && r.max === p.max,
            );
            return (
              <Pressable
                key={p.label}
                onPress={() => toggleAge(p.min, p.max)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>ACTIVITIES</Text>
        {activitiesError ? (
          <Pressable onPress={loadActivities} hitSlop={8}>
            <Text style={styles.activitiesError}>
              Couldn’t load activities. Tap to retry.
            </Text>
          </Pressable>
        ) : (
          <ActivityChips
            activities={activities}
            selectedIds={activityIds}
            onToggle={toggleActivity}
          />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable style={styles.resetBtn} onPress={onReset}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.applyBtn} onPress={onApply}>
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, gap: space.sm, paddingBottom: space.xl },
  label: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginTop: space.md,
  },
  value: { fontSize: fontSize.body, color: colors.text },
  activitiesError: { fontSize: fontSize.sub, color: colors.accent },
  slider: { alignSelf: "stretch" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  chipOn: { backgroundColor: colors.fillDark },
  chipText: { fontSize: fontSize.chip, color: colors.text },
  chipTextOn: { color: colors.textOnDark, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  resetBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  applyBtn: {
    flex: 2,
    height: 52,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.textOnDark,
  },
});
