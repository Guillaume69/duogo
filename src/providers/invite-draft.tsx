import {
  isDuplicateInvitationError,
  isPastScheduleInvitationError,
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

// Brouillon d'invitation : état du flux modal « Invite to Activity », borné à un
// destinataire (recipientId). Modèle Provider + hook (cf. country.tsx/auth.tsx) ;
// monté autour de l'écran de composition uniquement. La logique d'envoi (RPC,
// formatage date/heure, mapping d'erreur) vit ICI ; l'écran ne fait que câbler.
//
// Règle « quand » : la date est requise ; l'heure est soit un CRÉNEAU, soit une heure
// PRÉCISE, soit rien — jamais les deux (les setters maintiennent l'exclusivité).

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
  /** Envoie l'invitation ; renvoie true au succès (l'écran ferme alors la modale). */
  submit: () => Promise<boolean>;
};

const InviteDraftContext = createContext<InviteDraftValue | null>(null);

export function InviteDraftProvider({
  recipientId,
  children,
}: PropsWithChildren<{ recipientId: string }>) {
  const [activityId, setActivityIdState] = useState<string | null>(null);
  const [date, setDateState] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<Enums<"time_slot"> | null>(null);
  const [time, setTimeState] = useState<Date | null>(null);
  const [locationId, setLocationIdState] = useState<string | null>(null);
  const [message, setMessageState] = useState("");

  const [sending, setSending] = useState(false);
  // Garde synchrone anti double-tap (le state `sending` ne se voit qu'au render suivant).
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Aujourd'hui (minuit local) : borne basse du date picker.
  const minDate = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  // Toute édition d'un champ efface l'erreur d'envoi affichée : corriger le champ fautif
  // (ex. choisir une date/heure plus tardive après un rejet « déjà passé ») fait
  // disparaître le message, plutôt que de le laisser jusqu'au prochain Send.
  const setActivityId = useCallback((id: string) => {
    setActivityIdState(id);
    // Les lieux dépendent de l'activité (lieux filtrés par type) -> changer d'activité
    // invalide le lieu choisi : on le réinitialise systématiquement.
    setLocationIdState(null);
    setError(null);
  }, []);
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
    try {
      await sendInvitation({
        recipientId,
        activityId,
        date: formatLocalDate(date),
        timeSlot,
        time: time ? formatLocalTime(time) : null,
        locationId,
        message: message.trim() || null,
      });
      // Signal pour qu'Explore rafraîchisse le badge « Invited » à son prochain focus.
      markInvitationSent();
      // Succès : on NE remet pas sending à false (l'écran se ferme dans la foulée).
      return true;
    } catch (e) {
      setError(
        isDuplicateInvitationError(e)
          ? "There’s already a pending invitation with this person."
          : isPastScheduleInvitationError(e)
            ? "That date or time has already passed — please pick a later one."
            : "Couldn’t send the invitation. Please try again.",
      );
      sendingRef.current = false;
      setSending(false);
      return false;
    }
  }, [recipientId, activityId, date, timeSlot, time, locationId, message]);

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
