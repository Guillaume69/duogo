import { fetchMyActivityIds } from "@/data/activities";
import { warmSignedAvatarUrls } from "@/data/avatars";
import { findNearbyPeople, type NearbyPerson } from "@/data/people";
import { useFilters } from "@/providers/filters";
import { useLocation, type CaptureResult } from "@/providers/location";
import { useProfile } from "@/providers/profile";
import { useCallback, useEffect, useRef, useState } from "react";

// Orchestration de l'onglet Explore→People : capture la position UNE fois au montage
// (auto, sans jamais exposer de coordonnées), puis (re)charge la liste à chaque
// changement de filtre SANS re-capturer le GPS. La RPC ne renvoie qu'une distance
// grossière. L'écran ne fait que consommer cet état — toute la logique vit ici.
// "denied" = permission refusée (action requise) ; "error" = échec transitoire
// (timeout GPS, réseau) qu'on peut simplement réessayer ; "outside" = hors zone seedée.
export type LocStatus = "loading" | "denied" | "error" | "outside" | "ready";
export type PeopleStatus = "loading" | "error" | "ready";

export function useNearbyPeople() {
  const { capture } = useLocation();
  const { profile } = useProfile();
  const { filters } = useFilters();
  const userId = profile?.id ?? null;

  const [locStatus, setLocStatus] = useState<LocStatus>("loading");
  const [cityName, setCityName] = useState<string | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  const [myActivityIds, setMyActivityIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [peopleStatus, setPeopleStatus] = useState<PeopleStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);

  // Traduit le résultat de capture() en LocStatus (partagé entre montage et retry).
  const applyCapture = useCallback((r: CaptureResult) => {
    if (!r.ok) return setLocStatus(r.reason); // "denied" | "error"
    if (!r.city.cityId) return setLocStatus("outside");
    setCityName(r.city.cityName);
    setLocStatus("ready");
  }, []);

  // 1. Capture de la position UNE fois au montage (permission + GPS one-shot).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await capture();
      if (cancelled) return;
      applyCapture(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [capture, applyCapture]);

  // 2. Chargement des gens (fonction PURE de données) — dépend des filtres.
  const loadPeople = useCallback(async (): Promise<{
    status: PeopleStatus;
    people: NearbyPerson[];
    myActivityIds: Set<string>;
  }> => {
    // Mes intérêts (mise en avant des communs) = SECONDAIRE : on lance en parallèle
    // mais un échec ne doit pas masquer la liste -> on neutralise l'erreur (-> []).
    const minePromise = userId
      ? fetchMyActivityIds(userId).catch(() => [])
      : Promise.resolve<string[]>([]);

    // La liste est la donnée CRITIQUE : seul son échec donne le statut "error".
    let list: NearbyPerson[];
    try {
      list = await findNearbyPeople(filters);
    } catch {
      return { status: "error", people: [], myActivityIds: new Set() };
    }

    const mine = await minePromise;
    // Pré-signature des avatars = confort d'affichage, SECONDAIRE : erreur ignorée
    // (chaque Avatar resignera à l'unité au pire, avec un léger flash).
    await warmSignedAvatarUrls(
      list.map((p) => p.avatar_path).filter(Boolean),
    ).catch(() => {});
    return { status: "ready", people: list, myActivityIds: new Set(mine) };
  }, [filters, userId]);

  // Compteur de séquence : seul le chargement le PLUS RÉCEMMENT démarré applique son
  // résultat. Évite qu'un load périmé en vol (filtres changés, refresh + reload
  // concomitants) écrase une liste plus fraîche. Tous les chemins passent par runLoad.
  const reqIdRef = useRef(0);
  const runLoad = useCallback(async () => {
    const ticket = ++reqIdRef.current;
    const r = await loadPeople();
    if (reqIdRef.current !== ticket) return; // résultat périmé -> ignoré
    setPeople(r.people);
    setMyActivityIds(r.myActivityIds);
    setPeopleStatus(r.status);
  }, [loadPeople]);

  // (Re)charge la liste dès que la position est prête OU que les filtres changent.
  // On ne repasse PAS par "loading" ici (la liste se remplace en place, sans flash) ;
  // le compteur de séquence invalide déjà tout chargement précédent encore en vol.
  useEffect(() => {
    if (locStatus !== "ready") return;
    void runLoad();
  }, [locStatus, runLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runLoad();
    setRefreshing(false);
  }, [runLoad]);

  // Rechargement SILENCIEUX (sans spinner ni pull) : utilisé au retour sur l'onglet
  // Explore (focus) pour rafraîchir le badge « Invited » après l'envoi d'une invitation.
  // No-op tant que la position n'est pas prête (rien à recharger).
  const reloadPeople = useCallback(async () => {
    if (locStatus !== "ready") return;
    await runLoad();
  }, [locStatus, runLoad]);

  // Réessai depuis denied/error/outside : on re-tente la capture de position.
  const onRetryLocation = useCallback(async () => {
    setLocStatus("loading");
    applyCapture(await capture());
  }, [capture, applyCapture]);

  return {
    locStatus,
    cityName,
    people,
    myActivityIds,
    peopleStatus,
    refreshing,
    onRefresh,
    reloadPeople,
    onRetryLocation,
  };
}
