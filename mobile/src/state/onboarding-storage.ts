import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_KEY = 'beautilyze-onboarding-complete';
const ONBOARDING_FILE = 'beautilyze-onboarding-complete.txt';


export async function hasCompletedOnboarding() {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(STORAGE_KEY) === 'yes';
    const file = new File(Paths.document, ONBOARDING_FILE);
    return file.exists && (await file.text()).trim() === 'yes';
  } catch {
    return false;
  }
}

export function markOnboardingComplete() {
  try {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(STORAGE_KEY, 'yes'); return; }
    const file = new File(Paths.document, ONBOARDING_FILE);
    file.create({ intermediates: true, overwrite: true });
    file.write('yes');
  } catch {
    
  }
}
