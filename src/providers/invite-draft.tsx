import {
  isDuplicateInvitationError,
  isInvitationConflictError,
  isInvitationNotFoundError,
  isPastScheduleInvitationError,
  modifyInvitation,
  sendInvitation,
} from "@/data/invitations";
import type { Enums } from "@/lib/database.types";
import { formatLocalDate, formatLocalTime } from "@/utils/datetime";
import { markInvitationSent } from "@/utils/invite-events";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

// Brouillon d'invitation : état du flux « Invite to Activity » réutilisé en CRÉATION
// (nouvelle invitation vers un destinataire) ET en MODIFY (contre-proposition sur une
// invitation existante). Modèle Provider + hook (cf. country.tsx/auth.tsx) ; monté autour
// du formulaire. La logique d'envoi (RPC, formatage date/heure, mapping d'erreur) vit
// ICI ; le formulaire (InviteForm) ne fait que câbler.
//
// Règle « quand » : la date est requise ; l'heure est soit un CRÉNEAU, soit une heure
// PRÉCISE, soit rien — jamais les deux (les setters maintiennent l'exclusivité).

// Valeurs initiales du brouillon (pré-remplissage en mode modify).
export type InviteInitial = {
  activityId: string | null;
  date: Date | null;
  timeSlot: Enums<"time_slot"> | null;
  time: Date | null;
  locationId: string | null;
  message: string;
};

// Mode du brouillon : création (vers un destinataire) ou modification (d'une invitation).
export type InviteDraftConfig =
  | { mode: "create"; recipientId: string }
  | { mode: "modify"; invitationId: string; initial: InviteInitial };

type InviteDraftValue = {
  activityId: string | null;
  setActivityId: (id: string) => void;
  date: Date | null;
  setDate: (d: Date) => void;
  // Heure : créneau XOR heure précise. setSlot/setTime s'excluent mutuellement.
  timeSlot: Enums<"time_slot"> | null;
  time: Date | null;
  setSlot: (slot: Enums<"time_slot">) => void;
  setTime: (d: Date) => void;
  clearTime: () => void;
  locationId: string | null;
  setLocationId: (id: string | null) => void;
  message: string;
  setMessage: (text: string) => void;
  /** Date minimale sélectionnable (aujourd'hui) pour le date picker. */
  minDate: Date;
  /** Activité + date renseignées et envoi non en cours. */
  canSend: boolean;
  sending: boolean;
  error: string | null;
  /** Envoie/enregistre ; renvoie true au succès (le formulaire ferme alors l'écran). */
  submit: () => Promise<boolean>;
};

const InviteDraftContext = createContext<InviteDraftValue | null>(null);

export function InviteDraftProvider({
  config,
  children,
}: PropsWithChildren<{ config: InviteDraftConfig }>) {
  // État initial : vide en création, pré-rempli en modify.
  const initial: InviteInitial =
    config.mode === "modify"
      ? config.initial
      : {
          activityId: null,
          date: null,
          timeSlot: null,
          time: null,
          locationId: null,
          message: "",
        };

  const [activityId, setActivityIdState] = useState<string | null>(
    initial.activityId,
  );
  const [date, setDateState] = useState<Date | null>(initial.date);
  const [timeSlot, setTimeSlot] = useState<Enums<"time_slot"> | null>(
    initial.timeSlot,
  );
  const [time, setTimeState] = useState<Date | null>(initial.time);
  const [locationId, setLocationIdState] = useState<string | null>(
    initial.locationId,
  );
  const [message, setMessageState] = useState(initial.message);

  const [sending, setSending] = useState(false);
  // Garde synchrone anti double-tap (le state `sending` ne se voit qu'au render suivant).
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Aujourd'hui (minuit local) : borne basse du date picker.
  const minDate = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  // Toute édition d'un champ efface l'erreur d'envoi affichée.
  const setActivityId = useCallback(
    (id: string) => {
      // Re-sélectionner la MÊME activité = no-op : ne pas effacer le lieu (sinon, en
      // mode modify, retaper l'activité pré-remplie perdrait le lieu de l'invitation).
      if (id === activityId) return;
      setActivityIdState(id);
      // Changer d'activité invalide le lieu choisi (lieux filtrés par type) -> reset.
      setLocationIdState(null);
      setError(null);
    },
    [activityId],
  );
  const setDate = useCallback((d: Date) => {
    setDateState(d);
    setError(null);
  }, []);
  // Créneau et heure précise s'excluent : poser l'un efface l'autre.
  const setSlot = useCallback((slot: Enums<"time_slot">) => {
    setTimeSlot(slot);
    setTimeState(null);
    setError(null);
  }, []);
  const setTime = useCallback((d: Date) => {
    setTimeState(d);
    setTimeSlot(null);
    setError(null);
  }, []);
  const clearTime = useCallback(() => {
    setTimeSlot(null);
    setTimeState(null);
    setError(null);
  }, []);
  const setLocationId = useCallback((id: string | null) => {
    setLocationIdState(id);
    setError(null);
  }, []);
  const setMessage = useCallback((text: string) => {
    setMessageState(text);
    setError(null);
  }, []);

  const canSend = activityId !== null && date !== null && !sending;

  const submit = useCallback(async (): Promise<boolean> => {
    if (sendingRef.current) return false;
    if (!activityId || !date) {
      setError("Choose an activity and a date.");
      return false;
    }
    sendingRef.current = true;
    setSending(true);
    setError(null);
    // Payload commun aux deux modes.
    const fields = {
      activityId,
      date: formatLocalDate(date),
      timeSlot,
      time: time ? formatLocalTime(time) : null,
      locationId,
      message: message.trim() || null,
    };
    try {
      if (config.mode === "create") {
        await sendInvitation({ recipientId: config.recipientId, ...fields });
      } else {
        await modifyInvitation({ invitationId: config.invitationId, ...fields });
      }
      // Signal pour qu'Explore rafraîchisse ses badges au prochain focus.
      markInvitationSent();
      // Succès : on NE remet pas sending à false (l'écran se ferme dans la foulée).
      return true;
    } catch (e) {
      // Mapping par MODE : send_invitation lève aussi P0001 (destinataire indisponible,
      // activité/lieu inconnus…) -> en création, ne JAMAIS router un P0001 vers le libellé
      // « modify ». Le conflit/introuvable « modify » (pas mon tour / déjà répondue) est
      // propre au mode modify.
      let msg: string;
      if (isPastScheduleInvitationError(e)) {
        msg = "That date or time has already passed — please pick a later one.";
      } else if (config.mode === "create") {
        msg = isDuplicateInvitationError(e)
          ? "There’s already a pending invitation with this person."
          : isInvitationConflictError(e)
            ? "This person isn’t available anymore."
            : "Couldn’t send the invitation. Please try again.";
      } else {
        msg = isInvitationNotFoundError(e)
          ? "This invitation no longer exists."
          : isInvitationConflictError(e)
            ? "This invitation can no longer be changed."
            : "Couldn’t save your changes. Please try again.";
      }
      setError(msg);
      sendingRef.current = false;
      setSending(false);
      return false;
    }
  }, [config, activityId, date, timeSlot, time, locationId, message]);

  const value: InviteDraftValue = {
    activityId,
    setActivityId,
    date,
    setDate,
    timeSlot,
    time,
    setSlot,
    setTime,
    clearTime,
    locationId,
    setLocationId,
    message,
    setMessage,
    minDate,
    canSend,
    sending,
    error,
    submit,
  };

  return (
    <InviteDraftContext.Provider value={value}>
      {children}
    </InviteDraftContext.Provider>
  );
}

export function useInviteDraft() {
  const ctx = useContext(InviteDraftContext);
  if (!ctx) {
    throw new Error("useInviteDraft doit être utilisé dans un InviteDraftProvider");
  }
  return ctx;
}
