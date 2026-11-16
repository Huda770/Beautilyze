import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, PressableProps, StyleSheet, Text, TextProps, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


export const palette = {
  ink: '#3C2633', muted: '#6F6370', accent: '#61435C', accentDark: '#4A3046',
  soft: '#F6E4E3', lavender: '#E9E1F2', cream: '#FDF8F6', white: '#FFFFFF', line: '#EADDDB',
  blush: '#EFC9C6', lilac: '#B9A3D1', plum: '#65427B', danger: '#A6423A',
};


export const fonts = {
  serif: 'DMSerifDisplay_400Regular', regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', bold: 'DMSans_700Bold',
};

export function Screen({ children, ...props }: PropsWithChildren<ViewProps>) {
  const insets = useSafeAreaInsets();
  return <View {...props} style={[styles.screen, { paddingTop: Math.max(insets.top, 38), paddingBottom: Math.max(insets.bottom, 38) }, props.style]}>{children}</View>;
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
  return <Pressable accessibilityRole="button" {...props} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, props.style as object, props.disabled && { opacity: 0.5 }, pressed && styles.pressed]}>{icon}{<Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}</Pressable>;
}


export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 42, gap: 16 },
  pageTitle: { gap: 7, marginBottom: 4 },
  eyebrow: { color: palette.accent, fontSize: 12, fontFamily: fonts.bold, letterSpacing: 1.6 },
  title: { color: palette.ink, fontSize: 34, lineHeight: 40, fontFamily: fonts.serif },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  card: { backgroundColor: palette.white, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: palette.line, gap: 10 },
  label: { color: palette.ink, fontSize: 16, fontFamily: fonts.bold },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, fontFamily: fonts.regular },
  button: { minHeight: 54, borderRadius: 20, paddingHorizontal: 20, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonSecondary: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.accent },
  buttonText: { color: palette.white, fontSize: 15, fontFamily: fonts.bold },
  buttonTextSecondary: { color: palette.accentDark },
  pressed: { opacity: 0.78 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 20, backgroundColor: palette.white },
  chipSelected: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { color: palette.ink, fontSize: 13, fontFamily: fonts.medium },
  chipTextSelected: { color: palette.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
