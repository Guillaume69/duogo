import { DatePickerRow } from "@/components/DatePickerRow";
import { formatBirthDate } from "@/utils/profile-fields";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  maxDate: Date;
};

// Date de naissance : ligne + date picker natif (via DatePickerRow). La borne `maxDate`
// (≥ 18 ans) est gérée côté UI ; la base la re-vérifie. Ouvre sur maxDate quand vide.
export function BirthDateField({ value, onChange, maxDate }: Props) {
  return (
    <DatePickerRow
      value={value}
      onChange={onChange}
      placeholder="Set your date of birth"
      format={formatBirthDate}
      initialDate={maxDate}
      maximumDate={maxDate}
    />
  );
}
