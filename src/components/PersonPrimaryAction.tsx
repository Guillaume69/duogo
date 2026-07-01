import type { Person } from "@/data/people";
import { colors, fontSize, radius, space } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Action principale de la fiche personne, par ordre de priorité :
//   - cette personne m'a invité (invited_by_them + invitation active) -> « Respond to invitation » ;
//   - je l'ai invitée, j'attends (already_invited) -> « Invited » (consultable) + « Waiting… » ;
//   - on est matchés (conversation_id) -> « Message » (ouvre le chat) ;
//   - sinon -> « Invite to Activity » (ouvre la composition).
type Props = {
  person: Person;
  onInvite: () => void;
  onOpenInvitation: () => void;
  onOpenChat: () => void;
};

export function PersonPrimaryAction({
  person,
  onInvite,
  onOpenInvitation,
  onOpenChat,
}: Props) {
  if (person.invited_by_them && person.active_invitation_id) {
    return (
      <Pressable
        style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
        onPress={onOpenInvitation}
      >
        <Text style={styles.primaryText}>Respond to invitation</Text>
      </Pressable>
    );
  }
  if (person.already_invited) {
    return (
      <View>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.invited, pressed && styles.pressed]}
          onPress={onOpenInvitation}
          disabled={!person.active_invitation_id}
        >
          <Text style={styles.invitedText}>Invited</Text>
        </Pressable>
        <Text style={styles.hint}>Waiting for a reply</Text>
      </View>
    );
  }
  if (person.conversation_id) {
    return (
      <Pressable
        style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
        onPress={onOpenChat}
      >
        <Text style={styles.primaryText}>Message</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
      onPress={onInvite}
    >
      <Text style={styles.primaryText}>Invite to Activity</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.fillDark },
  primaryText: { fontSize: fontSize.body, fontWeight: "600", color: colors.textOnDark },
  invited: { backgroundColor: colors.fill },
  invitedText: { fontSize: fontSize.body, fontWeight: "600", color: colors.text },
  pressed: { opacity: 0.85 },
  hint: {
    fontSize: fontSize.hint,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.xs,
  },
});
