import { ProfileLoadError, ProfileLoading } from "@/components/ProfileGate";
import { ProfileProvider, useProfile } from "@/lib/profile";
import { Stack } from "expo-router";

export default function AppLayout() {
  // Le provider enveloppe la navigation ; AppNavigator lit le contexte en dessous.
  return (
    <ProfileProvider>
      <AppNavigator />
    </ProfileProvider>
  );
}

function AppNavigator() {
  const { profile, loading, error, reload } = useProfile();

  // Pendant le chargement du profil : spinner natif (pas d'écran blanc après le splash).
  if (loading) return <ProfileLoading />;
  // Échec de chargement : écran d'erreur + réessayer — et surtout PAS d'onboarding à tort.
  if (error) return <ProfileLoadError onRetry={reload} />;

  // Source unique du routage : l'état (le profil), jamais router.push.
  const needsOnboarding = !profile?.display_name;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!needsOnboarding}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
