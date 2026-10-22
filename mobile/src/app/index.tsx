import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { useAppState } from '@/state/app-state';

// The home screen links to analysis and shows the latest in-memory result.
export default function HomeScreen() {
  const { analysis } = useAppState();
  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    {/* Brand header and the main path into analysis. */}
    <View style={{ paddingTop: 8, gap: 5 }}><Text style={{ color: palette.green, fontSize: 14, fontWeight: '800', letterSpacing: 1.1 }}>BEAUTILYZE</Text><Text style={{ color: palette.muted, fontSize: 13 }}>A little care, made personal</Text></View>
    <View style={{ borderRadius: 26, backgroundColor: '#E9EEE4', padding: 23, gap: 14, overflow: 'hidden' }}>
      <Text style={{ fontSize: 12, color: palette.green, fontWeight: '800', letterSpacing: 1.5 }}>YOUR SKIN, YOUR WAY</Text>
      <Text style={{ fontSize: 34, lineHeight: 40, color: palette.ink, fontWeight: '700', letterSpacing: -0.6 }}>Feel good in the skin you’re in.</Text>
      <Body style={{ color: '#65746A', maxWidth: 300 }}>Understand your skin type and find a routine that feels right for you.</Body>
      <Link href="/analyze" asChild><Button title={analysis ? 'Update my analysis' : 'Start my skin analysis'} /></Link>
      <Text style={{ position: 'absolute', right: 8, top: 112, fontSize: 78, color: '#D2DDCE', opacity: 0.75 }}>✿</Text>
    </View>
    {/* Show the latest result, or explain the three steps if there is none. */}
    {analysis ? <Card style={{ backgroundColor: palette.white }}><View style={styles.row}><Label>Your latest result</Label><Text style={{ color: palette.green, fontWeight: '700' }}>READY</Text></View><Text style={{ color: palette.ink, fontSize: 27, fontWeight: '700', textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')}</Text><Body>Skin type · {new Date(analysis.createdAt).toLocaleDateString()}</Body><Link href="/routine" asChild><Button title="See my routine" secondary /></Link></Card> : <Card style={{ gap: 14 }}><Label>A simple three-step journey</Label>{[['01', 'Share a photo', 'A clear face photo gives the model what it needs.'], ['02', 'Get your skin type', 'The analysis runs through your connected backend.'], ['03', 'Explore a routine', 'See product matches from your skincare catalogue.']].map(([number, title, description]) => <View key={number} style={{ flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}><Text style={{ color: palette.gold, fontSize: 13, fontWeight: '800', paddingTop: 2 }}>{number}</Text><View style={{ flex: 1, gap: 3 }}><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 15 }}>{title}</Text><Body>{description}</Body></View></View>)}</Card>}
    <Body style={{ fontSize: 12, textAlign: 'center' }}>For everyday skincare guidance, not a medical diagnosis.</Body>
  </ScrollView></Screen>;
}
