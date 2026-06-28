import { colors } from "@/theme";
import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text as UIText,
} from "@expo/ui/jetpack-compose";
import { StyleSheet } from "react-native";

// Segmented natif Material 3 (Android) via @expo/ui/jetpack-compose. On force les
// couleurs + colorScheme="light" pour éviter le thème sombre système et le « blanc
// sur blanc » rencontré en brique 2.
// ⚠ Android-first : l'équivalent iOS (swift-ui `Picker` `.segmented`) sera ajouté
// dans un fichier `.ios.tsx` quand on s'attaquera à iOS.
type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme="light" style={styles.host}>
      <SingleChoiceSegmentedButtonRow>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <SegmentedButton
              key={opt.value}
              selected={selected}
              onClick={() => onChange(opt.value)}
              colors={{
                activeContainerColor: colors.fillDark,
                inactiveContainerColor: colors.surface,
                activeBorderColor: colors.fillDark,
                inactiveBorderColor: colors.border,
              }}
            >
              {/* Le slot Label rend un SlotView natif : on y met un Text natif
                  jetpack (pas une string brute), couleur selon l'état. */}
              <SegmentedButton.Label>
                <UIText color={selected ? colors.textOnDark : colors.text}>
                  {opt.label}
                </UIText>
              </SegmentedButton.Label>
            </SegmentedButton>
          );
        })}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { alignSelf: "stretch" },
});
