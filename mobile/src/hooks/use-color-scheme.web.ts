import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeNever = () => () => {};

// Static rendering has no browser preference, so render 'light' until the client has hydrated.
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
