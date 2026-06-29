// Signal one-shot « une invitation vient d'être envoyée ». Posé par le flux
// d'invitation (invite-draft) au succès, consommé par Explore à son prochain focus
// pour rafraîchir le badge « Invited » SANS recharger à chaque retour d'écran
// (le retour de la modale Filtre est déjà couvert par l'effet [filters]).
// État module simple (pas de React) : un seul drapeau global suffit pour ce besoin.
let pending = false;

export function markInvitationSent(): void {
  pending = true;
}

// Renvoie true (et réarme à false) si une invitation a été envoyée depuis la
// dernière consommation. Idempotent : deux lectures de suite -> true puis false.
export function consumeInvitationSent(): boolean {
  const v = pending;
  pending = false;
  return v;
}
