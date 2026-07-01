import { InviteForm } from "@/components/invitation/InviteForm";
import { InviteDraftProvider } from "@/providers/invite-draft";
import { firstName } from "@/utils/person-format";
import { colors, fontSize, space } from "@/theme";
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

// Flux modal « Invite to Activity » (création). Poussé depuis la fiche personne avec
// ?name= pour le titre (évite un fetch). Tout le formulaire vit dans InviteForm ; ici on
// ne fait que monter le brouillon en mode création et fixer le titre.
export default function InviteScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  // Garde param manquant (lien direct malformé) : pas d'écran d'invitation sans cible.
  if (!id) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "New invitation" }} />
        <Text style={styles.muted}>This person isn’t available right now.</Text>
      </View>
    );
  }

  const title = name ? `Invite ${firstName(name)}` : "New invitation";

  return (
    <InviteDraftProvider config={{ mode: "create", recipientId: id }}>
      <Stack.Screen options={{ title }} />
      <InviteForm submitLabel="Send invitation" submittingLabel="Sending…" />
    </InviteDraftProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.surface,
  },
  muted: { fontSize: fontSize.sub, color: colors.textMuted, textAlign: "center" },
});
