import { Avatar } from "@/components/ui/Avatar";
import { colors, fontSize, space } from "@/theme";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  /** avatar_path stocké (affiché si aucune image locale choisie). */
  path: string | null;
  /** URI locale choisie mais pas encore uploadée (preview immédiat). */
  pickedUri: string | null;
  label: string;
  onPress: () => void;
};

// Avatar (preview local prioritaire, sinon l'avatar stocké) + lien « Change Profile
// Photo ». L'ouverture du picker est gérée par l'appelant (onPress).
export function AvatarPicker({ path, pickedUri, label, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      {pickedUri ? (
        <Image source={{ uri: pickedUri }} style={styles.preview} contentFit="cover" />
      ) : (
        <Avatar path={path} size={120} label={label} />
      )}
      <Text style={styles.changePhoto}>Change Profile Photo</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.sm, marginBottom: space.md },
  preview: { width: 120, height: 120, borderRadius: 60 },
  changePhoto: { color: colors.accent, fontSize: fontSize.sub, fontWeight: "600" },
});
