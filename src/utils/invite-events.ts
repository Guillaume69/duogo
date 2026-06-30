// Signal one-shot « l'état d'une invitation a changé » (envoyée, acceptée, refusée,
// modifiée). Posé par les flux d'invitation (invite-draft, respond/modify), consommé par
// Explore à son prochain focus pour rafraîchir les badges « Invited »/« Your turn » SANS
// recharger à chaque retour d'écran (le retour de la modale Filtre est déjà couvert par
// l'effet [filters]). État module simple (pas de React) : un drapeau global suffit.
let pending = false;

export function markInvitationSent(): void {
  pending = true;
}

// Renvoie true (et réarme à false) si une invitation a changé depuis la dernière
// consommation. Idempotent : deux lectures de suite -> true puis false.
export function consumeInvitationSent(): boolean {
  const v = pending;
  pending = false;
  return v;
}
