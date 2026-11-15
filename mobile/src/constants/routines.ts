import { palette } from '@/components/beautilyze-ui';

export const ROUTINE_KEYS = ['Morning', 'Night', 'Weekly'] as const;
export type RoutineKey = (typeof ROUTINE_KEYS)[number];

export const ROUTINES: { key: RoutineKey; name: string; subtitle: string; icon: string; tint: string }[] = [
  { key: 'Morning', name: 'Morning routine', subtitle: 'Every day', icon: '☀️', tint: '#FFF2C7' },
  { key: 'Night', name: 'Night routine', subtitle: 'Every evening', icon: '🌙', tint: palette.lavender },
  { key: 'Weekly', name: 'Weekly routine', subtitle: 'Once a week', icon: '📅', tint: palette.soft },
];

export const isRoutineKey = (value: unknown): value is RoutineKey => ROUTINE_KEYS.includes(value as RoutineKey);
