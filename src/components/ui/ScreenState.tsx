import { colors, fontSize, radius, space } from "@/theme";
import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Kit d'états d'écran mutualisé. Jusqu'ici chaque écran redéclarait le même bloc « centré »
// (spinner / message d'erreur + « Try again » / indisponible) ET les mêmes styles
// (centered/title/muted/retry/retryText). On centralise à deux niveaux :
//   • primitives (Centered, StateTitle, StateText, RetryButton) — recomposables pour les écrans
//     à états sur-mesure (ex. Explore : localisation refusée / hors zone…) ;
//   • ScreenState — le routeur prêt-à-l'emploi pour le pattern courant loading/error/notfound.

export function Centered({ children }: PropsWithChildren) {
  return <View style={styles.centered}>{children}</View>;
}

export function StateTitle({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}

export function StateText({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.retry} onPress={onPress}>
      <Text style={styles.retryText}>Try again</Text>
    </Pressable>
  );
}

type ScreenStateProps = {
  status: "loading" | "error" | "notfound" | "ready";
  // Message de l'état d'erreur (échec de chargement).
  errorText: string;
  // Fourni -> bouton « Try again » dans l'état d'erreur (sinon aucun bouton).
  onRetry?: () => void;
  // Textes de l'état « introuvable » (ressource absente / plus disponible).
  notFoundTitle?: string;
  notFoundText?: string;
};

// Rend l'habillage des états loading/error/notfound ; renvoie null quand `ready` — l'écran
// prend alors le relais avec son contenu, rendu EN FRÈRE et gardé par son propre
// `status === "ready"`. Volontairement SANS children : un contenu « ready » qui déréférence
// une donnée encore nulle ne doit pas être évalué tant qu'on n'est pas ready (pas de deref,
// narrowing TS conservé côté écran, zéro `as` / pas de render-prop).
export function ScreenState({
  status,
  errorText,
  onRetry,
  notFoundTitle,
  notFoundText,
}: ScreenStateProps) {
  if (status === "loading") {
    return (
      <Centered>
        <ActivityIndicator />
      </Centered>
    );
  }
  if (status === "error") {
    return (
      <Centered>
        <StateText>{errorText}</StateText>
        {onRetry ? <RetryButton onPress={onRetry} /> : null}
      </Centered>
    );
  }
  if (status === "notfound") {
    return (
      <Centered>
        {notFoundTitle ? <StateTitle>{notFoundTitle}</StateTitle> : null}
        {notFoundText ? <StateText>{notFoundText}</StateText> : null}
      </Centered>
    );
  }
  return null; // ready -> l'écran rend son contenu
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
  retry: {
    marginTop: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
  },
  retryText: { fontSize: fontSize.body, fontWeight: "600", color: colors.textOnDark },
});
