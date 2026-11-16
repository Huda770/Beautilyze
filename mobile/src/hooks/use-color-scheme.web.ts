import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeNever = () => () => {};


export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
