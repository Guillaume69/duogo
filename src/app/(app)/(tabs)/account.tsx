import { Avatar } from "@/components/Avatar";
import {
  fetchActivities,
  fetchMyActivityIds,
} from "@/data/activities";
import { fetchCity } from "@/data/cities";
import { useAuth } from "@/lib/auth";
import { computeAge, GENDER_LABELS } from "@/lib/profile-fields";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { colors, fontSize, radius, space } from "@/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Onglet Account : vue du profil (lecture) + accès à l'édition + déconnexion.
export default function AccountScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [cityName, setCityName] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  // Données dérivées non stockées dans le profil : nom de ville + noms d'activités.
  // Dépend de l'OBJET `profile` : applyProfile crée un nouvel objet à chaque save/
  // capture -> l'effet se relance et recharge les intérêts (même si SEULES les
  // activités ont changé — elles ne vivent pas dans le contexte profil).
  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [acts, mine] = await Promise.all([
          fetchActivities(),
          fetchMyActivityIds(uid),
        ]);
        if (!cancelled) {
          setInterests(acts.filter((a) => mine.includes(a.id)).map((a) => a.name));
        }
      } catch {
        /* non bloquant */
      }
      if (profile?.city_id) {
        try {
          const city = await fetchCity(profile.city_id);
          if (!cancelled && city) setCityName(city.name);
        } catch {
          /* non bloquant */
        }
      } else if (!cancelled) {
        setCityName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const displayName = profile?.display_name ?? "";
  const phone = session?.user.phone ? `+${session.user.phone}` : null;
  const age = profile?.birth_date ? computeAge(profile.birth_date) : null;
  const genderLabel = profile?.gender ? GENDER_LABELS[profile.gender] : null;
  // Ligne méta « 27 · Male · Khon Kaen » (on n'affiche que ce qui est renseigné).
  const meta = [age !== null ? `${age}` : null, genderLabel, cityName]
    .filter((x) => x !== null)
    .join("  ·  ");

  async function signOut() {
    setSigningOut(true);
    // signOut() renvoie { error } (il ne throw PAS) : sur échec réseau la session
    // locale n'est pas vidée et le guard ne redirige pas -> on réactive le bouton.
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Avatar path={profile?.avatar_path ?? null} size={96} label={displayName} />
          <Text style={styles.name}>{displayName}</Text>
          {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
          {phone && <Text style={styles.phone}>{phone}</Text>}
        </View>

        {profile?.bio ? (
          <View style={styles.section}>
            <Text style={styles.label}>BIO</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        ) : null}

        {interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>ACTIVITIES</Text>
            <View style={styles.chips}>
              {interests.map((n) => (
                <View key={n} style={styles.chip}>
                  <Text style={styles.chipText}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={() => router.push("/edit-profile")}
        >
          <Text style={styles.editText}>Edit Profile</Text>
        </Pressable>
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
        onPress={signOut}
        disabled={signingOut}
      >
        <Text style={styles.signOutText}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.xl },
  flex: { flex: 1 },
  scroll: { gap: 20, paddingBottom: space.xl },
  header: { alignItems: "center", gap: 6, marginTop: space.sm },
  name: { fontSize: fontSize.xl, fontWeight: "700" },
  meta: { fontSize: fontSize.sub, color: colors.textMeta },
  phone: { fontSize: fontSize.sub, opacity: 0.5 },
  section: { gap: 6 },
  label: { fontSize: fontSize.label, fontWeight: "600", color: colors.textMuted },
  bio: { fontSize: fontSize.body, color: colors.text, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    // pills pleines noires (comme l'état sélectionné dans Edit Profile).
    backgroundColor: colors.fillDark,
  },
  chipText: { fontSize: fontSize.chip, color: colors.textOnDark },
  editBtn: {
    height: 52,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  editText: { color: colors.text, fontSize: fontSize.body, fontWeight: "600" },
  pressed: { opacity: 0.6 },
  signOutBtn: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { color: colors.textOnDark, fontSize: fontSize.body, fontWeight: "600" },
});
