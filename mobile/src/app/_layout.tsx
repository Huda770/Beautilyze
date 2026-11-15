import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { fonts, palette } from '@/components/beautilyze-ui';
import { OnboardingGate } from '@/components/onboarding/onboarding';
import { AppStateProvider } from '@/state/app-state';

// Keep the native splash visible until the app has drawn its first screen.
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ DMSerifDisplay_400Regular, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  // Wait for the brand fonts so text does not flash in the system font; fall back to it if loading fails.
  if (!fontsLoaded && !fontError) return null;
  return (
    // These providers share app state and the selected color theme with screens.
    <AppStateProvider>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerTintColor: palette.accent, headerStyle: { backgroundColor: palette.cream }, headerTitleStyle: { fontFamily: fonts.bold }, headerShadowVisible: false, headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="report" options={{ title: 'Skin report' }} />
        <Stack.Screen name="routine-detail" options={{ title: 'Routine' }} />
      </Stack>
      <OnboardingGate />
    </ThemeProvider>
    </AppStateProvider>
  );
}
