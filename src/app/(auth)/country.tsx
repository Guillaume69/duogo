import { COUNTRIES, flagEmoji, type Country } from "@/lib/countries";
import { useCountry } from "@/lib/country";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CountryPicker() {
  const { country, setCountry } = useCountry();
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/[^0-9]/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (digits.length > 0 && c.dial.includes(digits)),
    );
  }, [query]);

  function select(c: Country) {
    setCountry(c);
    router.back();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.title}>Pays</Text>
        <View style={styles.headerSpacer} />
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher un pays ou un indicatif…"
        placeholderTextColor="#9aa0a6"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
      />

      <FlatList
        data={data}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => select(item)}>
            <Text style={styles.flag}>{flagEmoji(item.code)}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.dial}>+{item.dial}</Text>
            {item.code === country.code && <Text style={styles.check}>✓</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun résultat</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { fontSize: 16, color: "#0a7ea4" },
  title: { fontSize: 17, fontWeight: "600" },
  headerSpacer: { width: 60 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 44,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 16 },
  dial: { fontSize: 15, opacity: 0.6 },
  check: { fontSize: 16, color: "#0a7ea4", marginLeft: 8 },
  empty: { textAlign: "center", marginTop: 32, opacity: 0.5 },
});
