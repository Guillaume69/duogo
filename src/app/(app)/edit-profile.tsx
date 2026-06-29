import { ActivityChips } from "@/components/ActivityChips";
import { AvatarPicker } from "@/components/AvatarPicker";
import { BirthDateField } from "@/components/BirthDateField";
import { FieldLabel } from "@/components/FieldLabel";
import { GenderField } from "@/components/GenderField";
import { useEditProfileForm } from "@/hooks/useEditProfileForm";
import { colors, fontSize, radius, space } from "@/theme";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Écran Edit profile : purement présentationnel. Toute la logique vit dans
// `useEditProfileForm` et chaque champ complexe dans son composant dédié.
export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const form = useEditProfileForm();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <AvatarPicker
          path={form.avatarPath}
          pickedUri={form.pickedAvatarUri}
          label={form.name}
          onPress={form.onPickAvatar}
        />

        <FieldLabel>NAME</FieldLabel>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={form.onChangeName}
          placeholder="Username"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />

        <FieldLabel>GENDER</FieldLabel>
        <GenderField value={form.gender} onChange={form.setGender} />

        <FieldLabel>DATE OF BIRTH</FieldLabel>
        <BirthDateField
          value={form.birthDate}
          onChange={form.setBirthDate}
          maxDate={form.maxBirthDate}
        />

        <FieldLabel>BIO</FieldLabel>
        <TextInput
          style={[styles.input, styles.bio]}
          value={form.bio}
          onChangeText={form.setBio}
          placeholder="Tell people a bit about you"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />

        <FieldLabel>ACTIVITIES</FieldLabel>
        <ActivityChips
          activities={form.activities}
          selectedIds={form.selectedActivityIds}
          onToggle={form.toggleActivity}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {form.error && <Text style={styles.error}>{form.error}</Text>}
        <Pressable
          style={[
            styles.saveBtn,
            (form.saving || !form.nameValid) && styles.saveBtnDisabled,
          ]}
          onPress={form.onSave}
          disabled={form.saving || !form.nameValid}
        >
          <Text style={styles.saveText}>
            {form.saving ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, gap: 6, paddingBottom: space.xl },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  bio: { minHeight: 96 },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: space.sm,
  },
  error: { color: colors.danger, fontSize: fontSize.hint },
  saveBtn: {
    height: 52,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { backgroundColor: colors.disabled },
  saveText: { color: colors.textOnDark, fontSize: fontSize.body, fontWeight: "600" },
});
