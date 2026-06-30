import type { Enums } from "@/lib/database.types";
import { colors } from "@/theme";

// Libellés + couleurs des badges de statut d'invitation (UI en anglais). « declined » est
// affiché « Denied » et « changes_requested » « Asked Changes » (alignés sur la maquette).
export const INVITATION_STATUS_LABELS: Record<
  Enums<"invitation_status">,
  string
> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Denied",
  changes_requested: "Asked Changes",
};

// Couleur de fond du badge par statut (texte blanc sur chacune). Map plutôt que switch
// -> retour garanti string, exhaustivité vérifiée par le Record typé sur l'enum.
const STATUS_COLORS: Record<Enums<"invitation_status">, string> = {
  pending: colors.fillDark,
  accepted: colors.success,
  declined: colors.danger,
  changes_requested: colors.warning,
};

export function invitationStatusColor(status: Enums<"invitation_status">): string {
  return STATUS_COLORS[status];
}
