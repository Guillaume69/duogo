import {
  fetchActivities,
  fetchMyActivityIds,
  setMyActivities,
  type Activity,
} from "@/data/activities";
import { fetchCity } from "@/data/cities";
import { uploadAvatar } from "@/data/avatars";
import { updateProfile, type ProfileEdit } from "@/data/profiles";
import type { Enums } from "@/lib/database.types";
import { useLocation } from "@/lib/location";
import {
  formatBirthDate,
  parseBirthDate,
} from "@/lib/profile-fields";
import { useProfile } from "@/lib/profile";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

// Toute la logique de l'écran Edit profile : état du formulaire, chargement,
// capture GPS, sélection d'avatar et orchestration du Save. L'écran ne fait que
// câbler ce hook à des composants de champ présentationnels.
export function useEditProfileForm() {
  const router = useRouter();
  const { profile, applyProfile } = useProfile();
  const { capture, status: locStatus } = useLocation();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [gender, setGender] = useState<Enums<"gender"> | null>(
    profile?.gender ?? null,
  );
  const [birthDate, setBirthDate] = useState<Date | null>(
    parseBirthDate(profile?.birth_date ?? null),
  );
  const [cityId, setCityId] = useState<string | null>(profile?.city_id ?? null);
  const [cityName, setCityName] = useState<string | null>(null);
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

  // Le statut géoloc vit dans le provider (persistant) -> on ne montre ses hints que
  // si l'utilisateur a tenté une capture DANS cette session de l'écran.
  const [captureAttempted, setCaptureAttempted] = useState(false);
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

  // Chargement : catalogue d'activités + sélection courante + nom de la ville.
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
      if (cityId) {
        try {
          const city = await fetchCity(cityId);
          if (!cancelled && city) setCityName(city.name);
        } catch {
          /* non bloquant */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function onCaptureLocation() {
    setCaptureAttempted(true);
    const resolved = await capture();
    if (!resolved) return; // permission refusée / erreur -> reflété par locStatus
    setCityId(resolved.cityId);
    setCityName(resolved.cityName);
    // La RPC a DÉJÀ persisté la position + city_id côté serveur -> on synchronise le
    // contexte tout de suite (que l'utilisateur save ou non, l'app reste cohérente).
    if (profile) applyProfile({ ...profile, city_id: resolved.cityId });
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
    // localisation
    cityName,
    hasCity: cityId !== null,
    locStatus,
    captureAttempted,
    onCaptureLocation,
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
