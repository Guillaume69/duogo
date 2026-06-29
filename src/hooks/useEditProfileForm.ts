import {
  fetchActivities,
  fetchMyActivityIds,
  setMyActivities,
  type Activity,
} from "@/data/activities";
import { uploadAvatar } from "@/data/avatars";
import { updateProfile, type ProfileEdit } from "@/data/profiles";
import type { Enums } from "@/lib/database.types";
import { formatBirthDate, parseBirthDate } from "@/utils/profile-fields";
import { useProfile } from "@/providers/profile";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

// Toute la logique de l'écran Edit profile : état du formulaire, chargement,
// sélection d'avatar et orchestration du Save. L'écran ne fait que câbler ce hook
// à des composants de champ présentationnels.
//
// NB : plus de champ « localisation » ici — la position est désormais capturée
// AUTOMATIQUEMENT à l'entrée de Browse (cf. onglet Explore), plus un réglage manuel.
export function useEditProfileForm() {
  const router = useRouter();
  const { profile, applyProfile } = useProfile();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [gender, setGender] = useState<Enums<"gender"> | null>(
    profile?.gender ?? null,
  );
  const [birthDate, setBirthDate] = useState<Date | null>(
    parseBirthDate(profile?.birth_date ?? null),
  );
  // Avatar choisi localement (URI), uploadé seulement au Save.
  const [pickedAvatar, setPickedAvatar] = useState<{
    uri: string;
    mime: string | undefined;
  } | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  // Tant que les activités ne sont pas chargées, on NE touche PAS aux liaisons au
  // Save (sinon setMyActivities([]) supprimerait toutes les activités du serveur).
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  // Garde synchrone anti double-tap (le state `saving` ne se voit qu'au render suivant).
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const userId = profile?.id ?? null;

  // Date max = il y a 18 ans (garde l'âge minimum côté UI ; la base le re-vérifie).
  const maxBirthDate = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear() - 18, t.getMonth(), t.getDate());
  }, []);

  // Chargement : catalogue d'activités + sélection courante.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [acts, mine] = await Promise.all([
          fetchActivities(),
          fetchMyActivityIds(userId),
        ]);
        if (cancelled) return;
        setActivities(acts);
        setSelectedActivityIds(mine);
        setActivitiesLoaded(true);
      } catch (e) {
        // En cas d'échec, activitiesLoaded reste false -> le Save ne touchera pas
        // aux liaisons d'activités (on ne risque pas de les effacer).
        console.error("load activities failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const trimmedName = name.trim();
  const nameValid =
    [...trimmedName].length >= 2 && [...trimmedName].length <= 30;

  function onChangeName(text: string) {
    setName(text);
    setError(null);
  }

  function toggleActivity(id: string) {
    setSelectedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onPickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setError(null);
    setPickedAvatar({ uri: asset.uri, mime: asset.mimeType });
  }

  async function onSave() {
    if (!userId || savingRef.current) return;
    if (!nameValid) {
      setError("Username must be 2–30 characters.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      // 1. Avatar (si changé) -> upload puis on garde le path stocké.
      let avatarPath = profile?.avatar_path ?? null;
      if (pickedAvatar) {
        avatarPath = await uploadAvatar(userId, pickedAvatar.uri, pickedAvatar.mime);
      }
      // 2. Champs scalaires du profil.
      const fields: ProfileEdit = {
        display_name: trimmedName,
        bio: bio.trim() || null,
        gender,
        birth_date: birthDate ? formatBirthDate(birthDate) : null,
        avatar_path: avatarPath,
      };
      const updated = await updateProfile(userId, fields);
      // 3. Centres d'intérêt — UNIQUEMENT s'ils ont été chargés (sinon on les
      //    effacerait : setMyActivities([]) supprimerait tout côté serveur).
      if (activitiesLoaded) {
        await setMyActivities(userId, selectedActivityIds);
      }
      // 4. Sync contexte (sans flash) + retour.
      applyProfile(updated);
      router.back();
    } catch (e) {
      console.error("save profile failed", e);
      setError("Couldn't save your profile. Please try again.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  return {
    // valeurs + setters de champ
    name,
    onChangeName,
    bio,
    setBio,
    gender,
    setGender,
    birthDate,
    setBirthDate,
    maxBirthDate,
    // avatar
    avatarPath: profile?.avatar_path ?? null,
    pickedAvatarUri: pickedAvatar?.uri ?? null,
    onPickAvatar,
    // activités
    activities,
    selectedActivityIds,
    toggleActivity,
    // save
    nameValid,
    saving,
    error,
    onSave,
  };
}
