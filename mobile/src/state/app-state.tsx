import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/api';

const SESSION_KEY = 'beautilyze.auth-token';

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

export type Account = { id: number; email: string; age_group: string };

type AuthResult = { user: Account; token: string };
type AppStateValue = {
  analysis: Analysis | null;
  setAnalysis: (analysis: Analysis | null) => void;
  ageGroup: string;
  setAgeGroup: (ageGroup: string) => void;
  account: Account | null;
  authReady: boolean;
  authError: string;
  clearAuthError: () => void;
  signIn: (email: string, password: string, register?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  // Combined allergy and sensitivity exclusions.
  allergies: string[];
  setAllergies: (allergies: string[]) => void;
};

const AppState = createContext<AppStateValue | null>(null);

async function readToken() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function saveToken(token: string) {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(SESSION_KEY, token);
}

async function removeToken() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function apiRequest(path: string, token: string, init: Omit<RequestInit, 'headers'> = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [ageGroup, setAgeGroupState] = useState('19-25');
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

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

  async function signIn(email: string, password: string, register = false) {
    setAuthError('');
    const response = await fetch(`${API_URL}/auth/${register ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'We could not sign you in.');
    const result = data as AuthResult;
    await saveToken(result.token);
    setToken(result.token);
    setAccount(result.user);
    setAgeGroupState(result.user.age_group);
  }

  async function setAgeGroup(value: string) {
    setAgeGroupState(value);
    if (token && account) {
      try {
        const data = await apiRequest('/auth/me', token, { method: 'PUT', body: JSON.stringify({ age_group: value }) });
        setAccount(data.user);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Your age preference could not be saved.');
      }
    }
  }

  async function signOut() {
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
    }
  }

  const value = useMemo(() => ({
    analysis, setAnalysis, ageGroup, setAgeGroup, account, authReady, authError,
    clearAuthError: () => setAuthError(''), signIn, signOut,
  }), [analysis, ageGroup, account, authReady, authError, token]);
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

export function useAppState() {
  const value = useContext(AppState);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
