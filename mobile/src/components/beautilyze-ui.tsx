import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, PressableProps, StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';

// Shared colors keep the main screens visually consistent.
export const palette = {
  ink: '#26362F', muted: '#7B8980', green: '#456A56', greenDark: '#314F3E',
  mint: '#EAF1E9', cream: '#F8F7F2', white: '#FFFFFF', line: '#E6E9E2',
  peach: '#F3E4D9', gold: '#B9935B', danger: '#A85047',
};

export function Screen({ children, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props} style={[styles.screen, props.style]}>{children}</View>;
}

export function PageTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={styles.pageTitle}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}<Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Card({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

export function Label({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.label, style]}>{children}</Text>;
}

export function Body({ children, style, ...props }: PropsWithChildren<TextProps>) {
  return <Text {...props} style={[styles.body, style]}>{children}</Text>;
}

export function Button({ title, secondary, icon, ...props }: PressableProps & { title: string; secondary?: boolean; icon?: ReactNode }) {
  return <Pressable accessibilityRole="button" {...props} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, props.style as object, pressed && styles.pressed]}>{icon}{<Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}</Pressable>;
}

// Shared layout, text, button, and chip styles for the app.
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 42, gap: 16 },
  pageTitle: { gap: 7, marginBottom: 4 },
  eyebrow: { color: palette.green, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: palette.ink, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: palette.white, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.line, gap: 10 },
  label: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  button: { minHeight: 54, borderRadius: 15, paddingHorizontal: 20, backgroundColor: palette.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonSecondary: { backgroundColor: palette.mint, borderWidth: 1, borderColor: '#D5E1D3' },
  buttonText: { color: palette.white, fontSize: 15, fontWeight: '700' },
  buttonTextSecondary: { color: palette.greenDark },
  pressed: { opacity: 0.78 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 20, backgroundColor: palette.white },
  chipSelected: { backgroundColor: palette.green, borderColor: palette.green },
  chipText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: palette.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
