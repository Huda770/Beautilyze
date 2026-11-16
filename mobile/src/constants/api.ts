import Constants from 'expo-constants';


const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const expoHostUri = Constants.expoConfig?.hostUri;

function getExpoHost() {
  if (!expoHostUri) return null;
  try {
    
    return new URL(expoHostUri.includes('://') ? expoHostUri : `http://${expoHostUri}`).hostname;
  } catch {
    return null;
  }
}

const expoHost = getExpoHost();
export const API_URL = (configuredUrl || (expoHost ? `http://${expoHost}:5000` : 'http://127.0.0.1:5000')).replace(/\/$/, '');

export async function readJsonResponse(response: { ok: boolean; json: () => Promise<any> }, fallbackError: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || fallbackError);
  return data;
}


