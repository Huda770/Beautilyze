import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_URL, readJsonResponse } from '@/constants/api';
import { DEFAULT_AGE_GROUP } from '@/constants/profile-options';
import type { RoutineKey } from '@/constants/routines';

const SESSION_KEY = 'beautilyze.auth-token';
const PREFERENCES_KEY = 'beautilyze.preferences.v1';
const PREFERENCES_FILE = 'beautilyze-preferences-v1.json';

// Analysis, routine and account types shared by the screens.
export type ProductRecommendation = {
  name: string;
  category: string;
  score?: number;
  matched_ingredients?: string[];
};

export type Analysis = {
  skin_type: string;
  confidence?: number;
  result_reliable?: boolean;
  note?: string;
  recommendation_note?: string;
  explanations?: { skin_type?: string; selected_concerns?: Record<string, string> };
  preferredCategories?: string[];
  routine?: Record<string, ProductRecommendation>;
  createdAt: string;
  ageGroup: string;
  concerns: string[];
  allergies: string[];
};

export type RoutineItem = ProductRecommendation & { explanation?: string; addedAt: string };
export type RoutineAssignments = Record<RoutineKey, RoutineItem[]>;
const emptyRoutines = (): RoutineAssignments => ({ Morning: [], Night: [], Weekly: [] });
const productId = (product: Pick<ProductRecommendation, 'name' | 'category'>) => `${product.category}::${product.name}`.trim().toLowerCase();
export const isSameProduct = (a: Pick<ProductRecommendation, 'name' | 'category'>, b: Pick<ProductRecommendation, 'name' | 'category'>) => productId(a) === productId(b);

export type Account = { id: number; email: string; age_group: string };
type SavedPreferences = { ageGroup: string; allergies: string[]; concerns: string[]; analysis: Analysis | null; routineAssignments: RoutineAssignments };
type AuthResult = { user: Account; token: string };

type AppStateValue = {
  analysis: Analysis | null;
  /** The most recent analysis, kept even when current preferences no longer match it (used on Home). */
  latestAnalysis: Analysis | null;
  setAnalysis: (analysis: Analysis | null) => void;
  ageGroup: string;
  setAgeGroup: (ageGroup: string) => void;
  account: Account | null;
  authReady: boolean;
  authError: string;
  clearAuthError: () => void;
  signIn: (email: string, password: string, register?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  allergies: string[];
  setAllergies: (allergies: string[]) => void;
  concerns: string[];
  setConcerns: (concerns: string[]) => void;
  routineAssignments: RoutineAssignments;
  /** Adds a product to a routine; returns false if it was already there. */
  addToRoutine: (routine: RoutineKey, product: ProductRecommendation, explanation?: string) => boolean;
  removeFromRoutine: (routine: RoutineKey, product: ProductRecommendation) => void;
};

const AppState = createContext<AppStateValue | null>(null);

// Session-token storage (SecureStore on native; web keeps no token) and authenticated API calls.
const normalizeList = (items: string[]) => JSON.stringify(items.map((item) => item.trim().toLowerCase()).sort());

async function readPreferences(): Promise<SavedPreferences | null> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(PREFERENCES_KEY) : await new File(Paths.document, PREFERENCES_FILE).text();
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedPreferences>;
    return { ageGroup: typeof saved.ageGroup === 'string' ? saved.ageGroup : DEFAULT_AGE_GROUP, allergies: Array.isArray(saved.allergies) ? saved.allergies : [], concerns: Array.isArray(saved.concerns) ? saved.concerns : [], analysis: saved.analysis ?? null, routineAssignments: { ...emptyRoutines(), ...(saved.routineAssignments || {}) } };
  } catch { return null; }
}

async function writePreferences(saved: SavedPreferences) {
  const raw = JSON.stringify(saved);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(PREFERENCES_KEY, raw);
  else { const file = new File(Paths.document, PREFERENCES_FILE); file.create({ intermediates: true, overwrite: true }); file.write(raw); }
}

async function readToken() {
  return Platform.OS === 'web' ? null : SecureStore.getItemAsync(SESSION_KEY);
}

async function saveToken(token: string) {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(SESSION_KEY, token);
}

async function removeToken() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function apiRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  return readJsonResponse(response, 'The request could not be completed.');
}

// Provider holding the account session, preferences, latest analysis and routines in memory.
export function AppStateProvider({ children }: PropsWithChildren) {
  const [storedAnalysis, setAnalysis] = useState<Analysis | null>(null);
  const [ageGroup, setAgeGroupState] = useState<string>(DEFAULT_AGE_GROUP);
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [routineAssignments, setRoutineAssignments] = useState<RoutineAssignments>(emptyRoutines);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const analysis = storedAnalysis && normalizeList(storedAnalysis.allergies || []) === normalizeList(allergies)
    ? storedAnalysis : null;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const savedToken = await readToken();
        if (!active) return;
        if (savedToken) {
          try {
            const data = await apiRequest('/auth/me', savedToken);
            if (!active) return;
            setToken(savedToken);
            setAccount(data.user);
            setAgeGroupState(data.user.age_group);
          } catch {
            await removeToken();
          }
        }
      } catch {
        if (active) setAuthError('Could not restore your saved sign-in. Please sign in again.');
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    readPreferences().then((saved) => {
      if (!active) return;
      if (saved) { setAgeGroupState(saved.ageGroup); setAllergies(saved.allergies); setConcerns(saved.concerns); setAnalysis(saved.analysis); setRoutineAssignments(saved.routineAssignments); }
      setPreferencesReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (preferencesReady) void writePreferences({ ageGroup, allergies, concerns, analysis: storedAnalysis, routineAssignments }).catch(() => {});
  }, [preferencesReady, ageGroup, allergies, concerns, storedAnalysis, routineAssignments]);

  async function signIn(email: string, password: string, register = false) {
    setAuthError('');
    const response = await fetch(`${API_URL}/auth/${register ? 'register' : 'login'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await readJsonResponse(response, 'We could not sign you in.') as AuthResult;
    await saveToken(result.token);
    setToken(result.token);
    setAccount(result.user);
    setAgeGroupState(result.user.age_group);
    setAllergies([]);
    setAnalysis(null);
    setRoutineAssignments(emptyRoutines());
  }

  const setAgeGroup = useCallback(async (value: string) => {
    setAgeGroupState(value);
    if (token && account) {
      try {
        const data = await apiRequest('/auth/me', token, { method: 'PUT', body: JSON.stringify({ age_group: value }) });
        setAccount(data.user);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Your age preference could not be saved.');
      }
    }
  }, [token, account]);

  const signOut = useCallback(async () => {
    const activeToken = token;
    setAuthError('');
    if (activeToken) {
      try { await apiRequest('/auth/logout', activeToken, { method: 'POST' }); } catch { /* Local sign-out still clears the session. */ }
    }
    try { await removeToken(); } catch {
      setAuthError('Your account is signed out, but this device could not clear its saved session token.');
    } finally {
      setAccount(null);
      setToken(null);
      setAnalysis(null);
      setAllergies([]);
      setRoutineAssignments(emptyRoutines());
    }
  }, [token]);

  const addToRoutine = useCallback((routine: RoutineKey, product: ProductRecommendation, explanation?: string) => {
    if (routineAssignments[routine].some((item) => isSameProduct(item, product))) return false;
    setRoutineAssignments((current) => current[routine].some((item) => isSameProduct(item, product)) ? current
      : { ...current, [routine]: [...current[routine], { ...product, explanation, addedAt: new Date().toISOString() }] });
    return true;
  }, [routineAssignments]);

  function removeFromRoutine(routine: RoutineKey, product: ProductRecommendation) {
    setRoutineAssignments((current) => ({ ...current, [routine]: current[routine].filter((item) => !isSameProduct(item, product)) }));
  }

  const value = useMemo(() => ({
    analysis, latestAnalysis: storedAnalysis, setAnalysis, ageGroup, setAgeGroup, account, authReady, authError,
    clearAuthError: () => setAuthError(''), signIn, signOut, allergies, setAllergies, concerns, setConcerns, routineAssignments, addToRoutine, removeFromRoutine,
  }), [analysis, storedAnalysis, ageGroup, setAgeGroup, account, authReady, authError, signOut, allergies, concerns, routineAssignments, addToRoutine]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

// Hook for screens to read and update the shared app state.
export function useAppState() {
  const value = useContext(AppState);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
