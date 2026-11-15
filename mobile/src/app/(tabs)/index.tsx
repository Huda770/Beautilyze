import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, fonts, palette, Screen, styles } from '@/components/beautilyze-ui';
import { useAppState } from '@/state/app-state';

// The home screen links to analysis and shows the latest in-memory result.
export default function HomeScreen() {
  const { latestAnalysis: analysis } = useAppState();
  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    {/* Brand header and the main path into analysis. */}
    <View style={{ paddingTop: 8, gap: 5 }}><Text style={{ color: palette.accent, fontSize: 14, fontFamily: fonts.bold, letterSpacing: 1.1 }}>BEAUTILYZE</Text><Text style={{ color: palette.muted, fontSize: 13 }}>A little care, made personal</Text></View>
    <View style={{ borderRadius: 26, backgroundColor: palette.soft, padding: 23, gap: 14, overflow: 'hidden' }}>
      <Text style={{ fontSize: 12, color: palette.accent, fontFamily: fonts.bold, letterSpacing: 1.5 }}>YOUR SKIN, YOUR WAY</Text>
      <Text style={{ fontSize: 34, lineHeight: 40, color: palette.ink, fontFamily: fonts.serif }}>Feel good in the skin you’re in.</Text>
      <Body style={{ color: palette.muted, maxWidth: 300 }}>Understand your skin type and find a routine that feels right for you.</Body>
      <Link href="/analyze" asChild><Button title={analysis ? 'Update my analysis' : 'Start my skin analysis'} /></Link>
    </View>
    <Card style={{ gap: 10, padding: 16 }}><Label>A simple three-step journey</Label>{[['01', 'Share a photo', 'Choose a clear face photo.'], ['02', 'Get your skin type', 'See your personalized estimate.'], ['03', 'Explore a routine', 'Find product matches for your goals.']].map(([number, title, description]) => <View key={number} style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}><Text style={{ color: palette.plum, fontSize: 12, fontFamily: fonts.bold, paddingTop: 2 }}>{number}</Text><View style={{ flex: 1, gap: 1 }}><Text style={{ color: palette.ink, fontFamily: fonts.bold, fontSize: 14 }}>{title}</Text><Body style={{ fontSize: 13 }}>{description}</Body></View></View>)}</Card>
    {analysis ? <Card style={{ backgroundColor: palette.white }}><View style={styles.row}><Label>Your latest result</Label></View><Text style={{ color: palette.ink, fontSize: 27, fontFamily: fonts.serif, textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')}</Text><Body>Skin type{analysis.createdAt ? ` · Analyzed ${new Date(analysis.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</Body>{analysis.concerns.length ? <Body>Goals: {analysis.concerns.join(', ')}</Body> : null}<Link href="/report" asChild><Button title="View my skin report" secondary /></Link></Card> : null}
    <Body style={{ fontSize: 12, textAlign: 'center' }}>For everyday skincare guidance, not a medical diagnosis.</Body>
  </ScrollView></Screen>;
}
