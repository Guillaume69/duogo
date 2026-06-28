import { ProfileLoadError, ProfileLoading } from "@/components/ProfileGate";
import { FilterProvider } from "@/lib/filters";
import { LocationProvider } from "@/lib/location";
import { ProfileProvider, useProfile } from "@/lib/profile";
import { Stack } from "expo-router";

export default function AppLayout() {
  // Les providers enveloppent la navigation ; AppNavigator lit le contexte en dessous.
  return (
    <ProfileProvider>
      <LocationProvider>
        <FilterProvider>
          <AppNavigator />
        </FilterProvider>
      </LocationProvider>
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
        {/* Détail plein écran au-dessus des onglets (poussé depuis Account). */}
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: true, title: "Edit profile" }}
        />
        {/* Fiche d'une personne (poussée depuis Browse) ; titre = pseudo, fixé par l'écran. */}
        <Stack.Screen
          name="person/[id]"
          options={{ headerShown: true, title: "Profile" }}
        />
        {/* Filtres de Browse, présentés en modale au-dessus des onglets. */}
        <Stack.Screen
          name="filter"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Filter by",
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
