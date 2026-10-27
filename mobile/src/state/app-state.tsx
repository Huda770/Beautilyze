import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

export type ProductRecommendation = {
  name: string;
  category: string;
  score?: number;
  matched_ingredients?: string[];
};

export type Analysis = {
  skin_type: string;
  confidence?: number;
  routine?: Record<string, ProductRecommendation>;
  createdAt: string;
  ageGroup: string;
  concerns: string[];
  // Combined allergy and sensitivity exclusions.
  allergies: string[];
};

// Values shared by screens while the app stays open.
type AppStateValue = {
  analysis: Analysis | null;
  setAnalysis: (analysis: Analysis | null) => void;
  ageGroup: string;
  setAgeGroup: (ageGroup: string) => void;
  // Combined allergy and sensitivity exclusions.
  allergies: string[];
  setAllergies: (allergies: string[]) => void;
};

const AppState = createContext<AppStateValue | null>(null);

// Keep the selected age range, latest analysis, and ingredient filters for this session.
export function AppStateProvider({ children }: PropsWithChildren) {
  const [storedAnalysis, setAnalysis] = useState<Analysis | null>(null);
  const [ageGroup, setAgeGroup] = useState('19-25');
  const [allergies, setAllergies] = useState<string[]>([]);
  // Hide stale results, including a request completed after preferences changed.
  const sameIngredients = (first: string[], second: string[]) =>
    JSON.stringify(first.map((item) => item.trim().toLowerCase()).sort()) ===
    JSON.stringify(second.map((item) => item.trim().toLowerCase()).sort());
  const analysis = storedAnalysis && sameIngredients(storedAnalysis.allergies, allergies) ? storedAnalysis : null;
  const value = useMemo(() => ({ analysis, setAnalysis, ageGroup, setAgeGroup, allergies, setAllergies }), [analysis, ageGroup, allergies]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

// Read shared state and show a clear error if the provider is missing.
export function useAppState() {
  const value = useContext(AppState);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
