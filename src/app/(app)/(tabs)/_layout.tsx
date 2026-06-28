import { NativeTabs } from "expo-router/unstable-native-tabs";

// Shell d'onglets natifs (API alpha SDK 56) : look OS natif, composants natifs.
// Chaque <Trigger name="..."> doit correspondre à un fichier de route dans (tabs)/ :
// index.tsx (Explore, onglet par défaut), inbox.tsx, account.tsx.
// `sf` = SF Symbols (iOS, notation pointée) ; `md` = Material Symbols (Android).
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Icon sf="tray" md="inbox" />
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
