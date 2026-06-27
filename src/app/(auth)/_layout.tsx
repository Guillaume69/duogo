import { CountryProvider } from "@/lib/country";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <CountryProvider>
      <Stack initialRouteName="login" screenOptions={{ headerShown: false }} />
    </CountryProvider>
  );
}
