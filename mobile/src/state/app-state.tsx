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
};

// Values shared by screens while the app stays open.
type AppStateValue = {
  analysis: Analysis | null;
  setAnalysis: (analysis: Analysis | null) => void;
  ageGroup: string;
  setAgeGroup: (ageGroup: string) => void;
};

const AppState = createContext<AppStateValue | null>(null);

// Keep the selected age range and latest analysis for this session.
export function AppStateProvider({ children }: PropsWithChildren) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [ageGroup, setAgeGroup] = useState('19-25');
  const value = useMemo(() => ({ analysis, setAnalysis, ageGroup, setAgeGroup }), [analysis, ageGroup]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

// Read shared state and show a clear error if the provider is missing.
export function useAppState() {
  const value = useContext(AppState);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
