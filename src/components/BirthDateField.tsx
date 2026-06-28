import { fieldStyles } from "@/components/fieldStyles";
import { formatBirthDate } from "@/lib/profile-fields";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
};

// Date de naissance via le date picker NATIF. Android : dialogue Material impératif
// (lisse). iOS : roue inline affichée au tap. La borne `maxDate` (≥18 ans) est gérée
// côté UI ; la base la re-vérifie.
export function BirthDateField({ value, onChange, maxDate }: Props) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: value ?? maxDate,
        mode: "date",
        maximumDate: maxDate,
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
          {value ? formatBirthDate(value) : "Set your date of birth"}
        </Text>
        <Text style={fieldStyles.chevron}>›</Text>
      </Pressable>
      {showIosPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={value ?? maxDate}
          mode="date"
          display="spinner"
          maximumDate={maxDate}
          onValueChange={(_event, selected) => onChange(selected)}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </>
  );
}
