import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_KEY = 'beautilyze-onboarding-complete';
const ONBOARDING_FILE = 'beautilyze-onboarding-complete.txt';

// Remember on this device that the welcome slides were finished, so they show only once.
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
    // If the flag cannot be saved, the slides simply appear again next launch.
  }
}
