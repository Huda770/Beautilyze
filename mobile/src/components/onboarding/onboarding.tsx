import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInRight, FadeOut, FadeOutLeft, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/components/beautilyze-ui';
import { brand, ScanScene } from '@/components/onboarding/illustrations';
import { useAppState } from '@/state/app-state';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/state/onboarding-storage';

const logo = require('@/assets/images/beautilyze-logo.png');
const SLIDES = 4;


export function OnboardingGate() {
  const { authReady, account } = useAppState();
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => { hasCompletedOnboarding().then(setCompleted); }, []);

  if (!authReady || completed !== false || account) return null;

  function finish() {
    markOnboardingComplete();
    setCompleted(true);
  }

  return <Onboarding onFinish={finish} />;
}

function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width - 48, 420);
  const compact = height < 720;

  function go(next: number) { setDirection(next > index ? 1 : -1); setIndex(Math.max(0, Math.min(SLIDES - 1, next))); }
  const entering = reduceMotion ? FadeIn.duration(1) : direction === 1 ? FadeInRight.duration(420) : FadeIn.duration(320);
  const exiting = reduceMotion ? FadeOut.duration(1) : direction === 1 ? FadeOutLeft.duration(260) : FadeOut.duration(200);

  const slides = [
    <LogoSlide key="logo" size={Math.min(contentWidth * 0.48, height * 0.25)} reduceMotion={reduceMotion} />,
    <ScanIntroSlide key="scan" width={contentWidth} sceneWidth={Math.max(220, Math.min(contentWidth, (height - insets.top - insets.bottom - (compact ? 300 : 360)) / 0.86))} reduceMotion={true} />,
    <SlideText key="insight" eyebrow="Readable results" title="Insights in plain language" body="Every result explains what it means and reminds you it is an estimate, not a diagnosis.">
      <InsightCard width={contentWidth} />
    </SlideText>,
    <SlideText key="routine" eyebrow="Your routine" title="Simple steps, morning and night" body="Product matches follow your skin type and goals, and skip ingredients you have told us to avoid.">
      <RoutineCards width={contentWidth} />
    </SlideText>,
  ];

  const last = index === SLIDES - 1;
  return <View style={[styles.overlay, { width, height, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
    <View style={[styles.topBar, { width: contentWidth }]}>
      {index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Previous slide" hitSlop={12} onPress={() => go(index - 1)}><Text style={styles.topLink}>Back</Text></Pressable> : <View />}
      {!last ? <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" hitSlop={12} onPress={() => go(SLIDES - 1)}><Text style={styles.topLink}>Skip</Text></Pressable> : null}
    </View>

    <Animated.View key={index} entering={entering} exiting={exiting} style={styles.slideArea}>
      <ScrollView contentContainerStyle={[styles.slideContent, { width: contentWidth }]} showsVerticalScrollIndicator={false} bounces={false}>
        {slides[index]}
      </ScrollView>
    </Animated.View>

    <View style={[styles.footer, { width: contentWidth }]}>
      <View style={styles.dots} accessible accessibilityLabel={`Slide ${index + 1} of ${SLIDES}`}>
        {Array.from({ length: SLIDES }, (_, dot) => <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />)}
      </View>
      <BrandButton title={last ? 'Get started' : 'Next   →'} label={last ? 'Get started' : 'Next slide'} onPress={() => last ? onFinish() : go(index + 1)} />
    </View>
  </View>;
}

// The logo rises, settles from a gentle zoom, and the welcome text follows a beat later.
const logoEntrance = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.82 }] },
  60: { opacity: 1, transform: [{ translateY: -2 }, { scale: 1.03 }], easing: Easing.out(Easing.cubic) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.inOut(Easing.quad) },
}).duration(900);

function LogoSlide({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  // The logo is cut to its own rounded tile, so no frame or margin is added around it.
  return <View style={{ alignItems: 'center', gap: 22, paddingTop: 12 }}>
    <Animated.View entering={reduceMotion ? undefined : logoEntrance} style={{ width: size, height: size }}>
      <Image source={logo} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="Beautilyze logo" />
    </Animated.View>
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(450).duration(500)} style={{ alignItems: 'center', gap: 22 }}>
    <Text style={[styles.title, { textAlign: 'center' }]}>Skincare starts with understanding</Text>
    <Text style={[styles.body, { textAlign: 'center', maxWidth: 320 }]}>Learn your skin type, set your goals, and build a routine that fits you.</Text>
    </Animated.View>
  </View>;
}

function ScanIntroSlide({ width, sceneWidth, reduceMotion }: { width: number; sceneWidth: number; reduceMotion: boolean }) {
  return <View style={{ width, gap: 14 }}>
    <View style={{ width, height: sceneWidth * 0.86, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderBottomWidth: 1, borderColor: brand.line }}>
      <ScanScene width={sceneWidth} reduceMotion={reduceMotion} />
    </View>
    <View style={{ gap: 8, paddingHorizontal: 4 }}>
      <Text style={[styles.eyebrow, { alignSelf: 'flex-start', backgroundColor: brand.lavender, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6 }]}>SKIN ANALYSIS</Text>
      <Text style={[styles.title, { fontSize: 38, lineHeight: 43 }]} accessibilityRole="header">Discover what your skin needs</Text>
      <Text style={styles.body}>Share one clear, well-lit photo. Beautilyze estimates your skin type in moments.</Text>
    </View>
  </View>;
}

function SlideText({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: React.ReactNode }) {
  return <View style={{ gap: 18, alignItems: 'center' }}>
    {children}
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  </View>;
}

function InsightCard({ width }: { width: number }) {
  return <View style={[styles.card, { width }]} accessible accessibilityLabel="Sample insight card: combination skin, with explanations of oil balance and your chosen goals.">
    <View style={styles.rowBetween}><Text style={styles.cardEyebrow}>SKIN TYPE ESTIMATE</Text><Text style={styles.sampleTag}>Sample</Text></View>
    <Text style={styles.cardTitle}>Combination</Text>
    <View style={styles.divider} />
    {[['What this means', 'Your T-zone may get shiny while cheeks stay balanced or dry.'], ['Your goals', 'Dullness and open pores, chosen by you.']].map(([heading, text]) => <View key={heading} style={{ gap: 2 }}>
      <Text style={styles.cardHeading}>{heading}</Text><Text style={styles.small}>{text}</Text>
    </View>)}
    <Text style={[styles.small, { fontSize: 12 }]}>An estimate from your photo, not a medical diagnosis.</Text>
  </View>;
}

function RoutineCards({ width }: { width: number }) {
  const routines = [
    { name: 'Morning', note: 'AM', tint: brand.blush, steps: ['Cleanser', 'Serum', 'Moisturizer', 'Sunscreen'] },
    { name: 'Evening', note: 'PM', tint: brand.lavender, steps: ['Cleanser', 'Treatment', 'Moisturizer'] },
  ];
  const twoColumns = width >= 330;
  return <View style={{ width, flexDirection: twoColumns ? 'row' : 'column', gap: 12 }}>
    {routines.map((routine) => <View key={routine.name} style={[styles.card, { flex: twoColumns ? 1 : undefined, backgroundColor: routine.tint, borderColor: 'transparent', gap: 10 }]} accessible accessibilityLabel={`Sample ${routine.name.toLowerCase()} routine: ${routine.steps.join(', ')}`}>
      <View style={styles.rowBetween}><Text style={styles.cardHeading}>{routine.name}</Text><Text style={styles.sampleTag}>{routine.note}</Text></View>
      {routine.steps.map((step, number) => <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number + 1}</Text></View>
        <Text style={[styles.small, { color: brand.ink }]}>{step}</Text>
      </View>)}
    </View>)}
  </View>;
}

function BrandButton({ title, label, secondary, onPress }: { title: string; label: string; secondary?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, pressed && { opacity: 0.8 }]}>
    <Text style={[styles.buttonText, secondary && { color: brand.mauve }]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, backgroundColor: brand.cream, alignItems: 'center', zIndex: 10 },
  topBar: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topLink: { color: brand.mauve, fontFamily: fonts.bold, fontSize: 15 },
  slideArea: { flex: 1, alignSelf: 'stretch' },
  slideContent: { flexGrow: 1, justifyContent: 'center', alignSelf: 'center', paddingVertical: 12 },
  eyebrow: { color: brand.plum, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6 },
  title: { color: brand.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36 },
  body: { color: brand.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  footer: { gap: 16, paddingTop: 8, paddingBottom: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: brand.line },
  dotActive: { width: 22, backgroundColor: brand.mauve },
  button: { minHeight: 58, borderRadius: 30, backgroundColor: brand.mauve, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonSecondary: { backgroundColor: brand.white, borderWidth: 1.5, borderColor: brand.mauve },
  buttonText: { color: brand.white, fontFamily: fonts.bold, fontSize: 16 },
  card: { backgroundColor: brand.white, borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: brand.line },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: brand.plum, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4 },
  sampleTag: { color: brand.mauve, fontFamily: fonts.bold, fontSize: 11, backgroundColor: brand.lavender, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  cardTitle: { color: brand.ink, fontFamily: fonts.serif, fontSize: 28 },
  cardHeading: { color: brand.ink, fontFamily: fonts.bold, fontSize: 15 },
  small: { color: brand.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: brand.line },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: brand.white, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: brand.plum, fontFamily: fonts.bold, fontSize: 12 },
});
