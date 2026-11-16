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


export type ProductRecommendation = {
  name: string;
  category: string;
  score?: number;
  matched_ingredients?: string[];
};

export type Analysis = {
  skin_type: string;
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
  return Platform.OS === 'web' ? globalThis.localStorage?.getItem(SESSION_KEY) ?? null : SecureStore.getItemAsync(SESSION_KEY);
}

async function saveToken(token: string) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(SESSION_KEY, token);
  else await SecureStore.setItemAsync(SESSION_KEY, token);
}

async function removeToken() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(SESSION_KEY);
  else await SecureStore.deleteItemAsync(SESSION_KEY);
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
  const [accountAnalysisReady, setAccountAnalysisReady] = useState(false);
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
            const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } });
            if (response.status === 401) await removeToken();
            else if (response.ok) {
              const data = await response.json();
              if (!active) return;
              setToken(savedToken);
              setAccount(data.user);
              setAgeGroupState(data.user.age_group);
            } else if (active) {
              setAuthError('Could not verify your saved sign-in. Check the server connection and reopen Profile.');
            }
          } catch {
            if (active) setAuthError('Could not reach the server to verify your saved sign-in. Your saved session was kept.');
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
      if (saved) { setAgeGroupState(saved.ageGroup); setAllergies(saved.allergies); setConcerns(saved.concerns); setRoutineAssignments(saved.routineAssignments); }
      setPreferencesReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authReady || !preferencesReady) return;
    let active = true;
    if (!account) {
      Promise.resolve().then(() => {
        if (active) { setAnalysis(null); setAccountAnalysisReady(true); }
      });
      return () => { active = false; };
    }
    readPreferences().then((saved) => {
      if (active) { setAnalysis(saved?.analysis ?? null); setAccountAnalysisReady(true); }
    });
    return () => { active = false; };
  }, [authReady, preferencesReady, account]);

  useEffect(() => {
    if (preferencesReady && accountAnalysisReady) void writePreferences({ ageGroup, allergies, concerns, analysis: account ? storedAnalysis : null, routineAssignments }).catch(() => {});
  }, [preferencesReady, accountAnalysisReady, account, ageGroup, allergies, concerns, storedAnalysis, routineAssignments]);

  async function signIn(email: string, password: string, register = false) {
    setAuthError('');
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(`Can't reach the Beautilyze server at ${API_URL}. Make sure the backend is running and your phone can reach this computer.`);
    }
    const action = register ? 'create your account' : 'sign you in';
    const result = await readJsonResponse(response, `The server returned an unexpected response while trying to ${action} (HTTP ${response.status}). Check that the current backend is running.`) as AuthResult;
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
