import { fieldStyles } from "@/components/ui/fieldStyles";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  /** Formatage d'affichage de la date choisie (ex. DOB en 'YYYY-MM-DD', invitation conviviale). */
  format: (date: Date) => string;
  /** Date à laquelle ouvrir le picker quand aucune valeur n'est encore choisie. */
  initialDate: Date;
  minimumDate?: Date;
  maximumDate?: Date;
};

// Ligne « valeur + chevron » ouvrant le date picker NATIF. Android : dialogue Material
// impératif (lisse). iOS : roue inline affichée au tap. Source unique du branchement
// par plateforme — réutilisée par la date de naissance et la date d'invitation.
export function DatePickerRow({
  value,
  onChange,
  placeholder,
  format,
  initialDate,
  minimumDate,
  maximumDate,
}: Props) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: value ?? initialDate,
        mode: "date",
        minimumDate,
        maximumDate,
        onValueChange: (_event, selected) => onChange(selected),
      });
    } else {
      setShowIosPicker(true);
    }
  }

  return (
    <>
      <Pressable style={fieldStyles.row} onPress={open}>
        <Text style={value ? fieldStyles.rowText : fieldStyles.rowPlaceholder}>
          {value ? format(value) : placeholder}
        </Text>
        <Text style={fieldStyles.chevron}>›</Text>
      </Pressable>
      {showIosPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={value ?? initialDate}
          mode="date"
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_event, selected) => onChange(selected)}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </>
  );
}
