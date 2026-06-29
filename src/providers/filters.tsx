import type { AgeRange } from "@/data/people";
import type { Enums } from "@/lib/database.types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

// Filtres de Browse People. État pur en mémoire (pas de persistance pour le MVP) —
// d'où un simple Provider sans couche data. La sheet édite un brouillon local et
// applique via setFilters ; l'écran Explore relit `filters` et relance la recherche.
export type Filters = {
  radiusKm: number;
  genders: Enums<"gender">[];
  // Tranches d'âge sélectionnées (multi, disjointes possibles). [] = tous les âges.
  ageRanges: AgeRange[];
  activityIds: string[];
};

// Rayon par défaut = plafond serveur (cf. find_nearby_people) : « pas de filtre rayon ».
export const DEFAULT_RADIUS_KM = 50;

export const DEFAULT_FILTERS: Filters = {
  radiusKm: DEFAULT_RADIUS_KM,
  genders: [],
  ageRanges: [],
  activityIds: [],
};

type FilterContextValue = {
  filters: Filters;
  setFilters: (next: Filters) => void;
  reset: () => void;
  /** Nombre de critères actifs (pour le badge sur l'icône filtre). */
  activeCount: number;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: PropsWithChildren) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.radiusKm < DEFAULT_RADIUS_KM) n++;
    if (filters.genders.length > 0) n++;
    if (filters.ageRanges.length > 0) n++;
    if (filters.activityIds.length > 0) n++;
    return n;
  }, [filters]);

  return (
    <FilterContext.Provider value={{ filters, setFilters, reset, activeCount }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error("useFilters doit être utilisé dans un FilterProvider");
  }
  return ctx;
}
