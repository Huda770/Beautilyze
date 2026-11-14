import Constants from 'expo-constants';

// Use a manual address only when the backend is hosted on another machine.
const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const expoHostUri = Constants.expoConfig?.hostUri;

function getExpoHost() {
  if (!expoHostUri) return null;
  try {
    // hostUri is supplied by Expo CLI and changes when the laptop's LAN address changes.
    return new URL(expoHostUri.includes('://') ? expoHostUri : `http://${expoHostUri}`).hostname;
  } catch {
    return null;
  }
}

const expoHost = getExpoHost();

// Expo Go's manifest host is the development computer's LAN address, which
// lets a phone reach a backend bound to 0.0.0.0 without hardcoding an IP.
export const API_URL = (configuredUrl || (expoHost ? `http://${expoHost}:5000` : 'http://127.0.0.1:5000')).replace(/\/$/, '');

// Read a JSON API response, turning error statuses (or non-JSON error pages) into an Error with the API's message.
export async function readJsonResponse(response: { ok: boolean; json: () => Promise<any> }, fallbackError: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || fallbackError);
  return data;
}
