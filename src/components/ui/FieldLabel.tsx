import { Text } from "react-native";
import { fieldStyles } from "@/components/ui/fieldStyles";

// Label de section en majuscules gris (NAME, GENDER, …).
export function FieldLabel({ children }: { children: string }) {
  return <Text style={fieldStyles.label}>{children}</Text>;
}
