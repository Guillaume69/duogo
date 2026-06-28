import type { CountryCode } from "libphonenumber-js";

// Données pays pour le sélecteur d'indicatif.
// Liste large mais volontairement non exhaustive — extensible au besoin.
// `name` est affiché dans l'UI (donc en anglais) ; `code` = ISO 3166-1 alpha-2 ;
// `dial` = indicatif international (sans +).
export type Country = { name: string; code: CountryCode; dial: string };

export const COUNTRIES: Country[] = [
  { name: "France", code: "FR", dial: "33" },
  { name: "Belgium", code: "BE", dial: "32" },
  { name: "Switzerland", code: "CH", dial: "41" },
  { name: "Luxembourg", code: "LU", dial: "352" },
  { name: "Canada", code: "CA", dial: "1" },
  { name: "United States", code: "US", dial: "1" },
  { name: "United Kingdom", code: "GB", dial: "44" },
  { name: "Germany", code: "DE", dial: "49" },
  { name: "Spain", code: "ES", dial: "34" },
  { name: "Italy", code: "IT", dial: "39" },
  { name: "Portugal", code: "PT", dial: "351" },
  { name: "Netherlands", code: "NL", dial: "31" },
  { name: "Ireland", code: "IE", dial: "353" },
  { name: "Austria", code: "AT", dial: "43" },
  { name: "Denmark", code: "DK", dial: "45" },
  { name: "Sweden", code: "SE", dial: "46" },
  { name: "Norway", code: "NO", dial: "47" },
  { name: "Finland", code: "FI", dial: "358" },
  { name: "Iceland", code: "IS", dial: "354" },
  { name: "Poland", code: "PL", dial: "48" },
  { name: "Czechia", code: "CZ", dial: "420" },
  { name: "Slovakia", code: "SK", dial: "421" },
  { name: "Hungary", code: "HU", dial: "36" },
  { name: "Romania", code: "RO", dial: "40" },
  { name: "Bulgaria", code: "BG", dial: "359" },
  { name: "Greece", code: "GR", dial: "30" },
  { name: "Croatia", code: "HR", dial: "385" },
  { name: "Slovenia", code: "SI", dial: "386" },
  { name: "Serbia", code: "RS", dial: "381" },
  { name: "Bosnia and Herzegovina", code: "BA", dial: "387" },
  { name: "Albania", code: "AL", dial: "355" },
  { name: "North Macedonia", code: "MK", dial: "389" },
  { name: "Montenegro", code: "ME", dial: "382" },
  { name: "Ukraine", code: "UA", dial: "380" },
  { name: "Russia", code: "RU", dial: "7" },
  { name: "Estonia", code: "EE", dial: "372" },
  { name: "Latvia", code: "LV", dial: "371" },
  { name: "Lithuania", code: "LT", dial: "370" },
  { name: "Turkey", code: "TR", dial: "90" },
  { name: "Cyprus", code: "CY", dial: "357" },
  { name: "Malta", code: "MT", dial: "356" },
  { name: "Morocco", code: "MA", dial: "212" },
  { name: "Algeria", code: "DZ", dial: "213" },
  { name: "Tunisia", code: "TN", dial: "216" },
  { name: "Egypt", code: "EG", dial: "20" },
  { name: "Senegal", code: "SN", dial: "221" },
  { name: "Ivory Coast", code: "CI", dial: "225" },
  { name: "Cameroon", code: "CM", dial: "237" },
  { name: "Nigeria", code: "NG", dial: "234" },
  { name: "Ghana", code: "GH", dial: "233" },
  { name: "Kenya", code: "KE", dial: "254" },
  { name: "South Africa", code: "ZA", dial: "27" },
  { name: "Mali", code: "ML", dial: "223" },
  { name: "Burkina Faso", code: "BF", dial: "226" },
  { name: "Niger", code: "NE", dial: "227" },
  { name: "Guinea", code: "GN", dial: "224" },
  { name: "Benin", code: "BJ", dial: "229" },
  { name: "Togo", code: "TG", dial: "228" },
  { name: "Congo (DRC)", code: "CD", dial: "243" },
  { name: "Madagascar", code: "MG", dial: "261" },
  { name: "Mexico", code: "MX", dial: "52" },
  { name: "Brazil", code: "BR", dial: "55" },
  { name: "Argentina", code: "AR", dial: "54" },
  { name: "Chile", code: "CL", dial: "56" },
  { name: "Colombia", code: "CO", dial: "57" },
  { name: "Peru", code: "PE", dial: "51" },
  { name: "Venezuela", code: "VE", dial: "58" },
  { name: "Ecuador", code: "EC", dial: "593" },
  { name: "Bolivia", code: "BO", dial: "591" },
  { name: "Uruguay", code: "UY", dial: "598" },
  { name: "Paraguay", code: "PY", dial: "595" },
  { name: "Costa Rica", code: "CR", dial: "506" },
  { name: "Panama", code: "PA", dial: "507" },
  { name: "Dominican Republic", code: "DO", dial: "1" },
  { name: "Guatemala", code: "GT", dial: "502" },
  { name: "Cuba", code: "CU", dial: "53" },
  { name: "China", code: "CN", dial: "86" },
  { name: "Japan", code: "JP", dial: "81" },
  { name: "South Korea", code: "KR", dial: "82" },
  { name: "India", code: "IN", dial: "91" },
  { name: "Pakistan", code: "PK", dial: "92" },
  { name: "Bangladesh", code: "BD", dial: "880" },
  { name: "Indonesia", code: "ID", dial: "62" },
  { name: "Malaysia", code: "MY", dial: "60" },
  { name: "Singapore", code: "SG", dial: "65" },
  { name: "Thailand", code: "TH", dial: "66" },
  { name: "Vietnam", code: "VN", dial: "84" },
  { name: "Philippines", code: "PH", dial: "63" },
  { name: "Hong Kong", code: "HK", dial: "852" },
  { name: "Taiwan", code: "TW", dial: "886" },
  { name: "Saudi Arabia", code: "SA", dial: "966" },
  { name: "United Arab Emirates", code: "AE", dial: "971" },
  { name: "Qatar", code: "QA", dial: "974" },
  { name: "Kuwait", code: "KW", dial: "965" },
  { name: "Bahrain", code: "BH", dial: "973" },
  { name: "Oman", code: "OM", dial: "968" },
  { name: "Israel", code: "IL", dial: "972" },
  { name: "Jordan", code: "JO", dial: "962" },
  { name: "Lebanon", code: "LB", dial: "961" },
  { name: "Iraq", code: "IQ", dial: "964" },
  { name: "Iran", code: "IR", dial: "98" },
  { name: "Australia", code: "AU", dial: "61" },
  { name: "New Zealand", code: "NZ", dial: "64" },
];

// Drapeau emoji à partir du code ISO (regional indicator symbols).
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function findCountry(code?: string | null): Country | undefined {
  if (!code) return undefined;
  const up = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === up);
}

// Pays par défaut si la locale de l'appareil est inconnue / absente de la liste.
export const DEFAULT_COUNTRY: Country = findCountry("FR") ?? COUNTRIES[0];
