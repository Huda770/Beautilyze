import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_KEY = 'beautilyze-anonymous-install-id';
const INSTALL_ID_FILE = 'beautilyze-anonymous-install-id.txt';

let installIdPromise: Promise<string> | null = null;

function createInstallId() {
  // This ID identifies one app installation; it is not a password or an account credential.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function readOrCreateInstallId() {
  if (Platform.OS === 'web') {
    const current = globalThis.localStorage.getItem(STORAGE_KEY);
    if (current) return current;
    const created = createInstallId();
    globalThis.localStorage.setItem(STORAGE_KEY, created);
    return created;
  }

  const file = new File(Paths.document, INSTALL_ID_FILE);
  if (file.exists) {
    const current = (await file.text()).trim();
    if (current) return current;
  }
  const created = createInstallId();
  file.create({ intermediates: true, overwrite: true });
  file.write(created);
  return created;
}

// Keep a single in-flight read so development re-renders cannot create two IDs.
export function getOrCreateInstallId() {
  if (!installIdPromise) {
    installIdPromise = readOrCreateInstallId().catch((error) => {
      installIdPromise = null;
      throw error;
    });
  }
  return installIdPromise;
}
