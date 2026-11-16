

import '@/global.css';

import { Platform } from 'react-native';


export const Colors = {
  light: {
    text: '#3C2633',
    background: '#FDF8F6',
    backgroundElement: '#F6E4E3',
    backgroundSelected: '#E9E1F2',
    textSecondary: '#6F6370',
  },
  dark: {
    text: '#FDF8F6',
    background: '#261A24',
    backgroundElement: '#36263A',
    backgroundSelected: '#4A3448',
    textSecondary: '#CDBFD0',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    
    sans: 'system-ui',
    
    serif: 'ui-serif',
    
    rounded: 'ui-rounded',
    
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
