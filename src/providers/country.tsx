import { Country, DEFAULT_COUNTRY, findCountry } from "@/utils/countries";
import { getLocales } from "expo-localization";
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";

function initialCountry(): Country {
  try {
    const region = getLocales()[0]?.regionCode;
    return findCountry(region) ?? DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}

type CountryContextValue = {
  country: Country;
  setCountry: (c: Country) => void;
};

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: PropsWithChildren) {
  const [country, setCountry] = useState<Country>(initialCountry);
  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    throw new Error("useCountry doit être utilisé dans un CountryProvider");
  }
  return ctx;
}
