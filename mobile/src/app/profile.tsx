import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Body, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { API_URL } from '@/constants/api';
import { useAppState } from '@/state/app-state';

const ageGroups = ['14-18', '19-25', '26-35', '36-45', '45+'];

// Show profile preferences and whether the backend can be reached.
export default function ProfileScreen() {
  const { ageGroup, setAgeGroup, analysis } = useAppState();
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  // Check the backend health route when this screen first opens.
  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/health`).then(async (response) => {
      const health = await response.json();
      if (mounted) setServerStatus(response.ok && health.status === 'ok' ? 'online' : 'offline');
    }).catch(() => { if (mounted) setServerStatus('offline'); });
    return () => { mounted = false; };
  }, []);
  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="A little about you" title="Your profile" subtitle="Set your preferences and check your app connection." />
    {/* Age preference is reused on the Analyze screen. */}
    <Card><Text style={{ width: 58, height: 58, lineHeight: 58, textAlign: 'center', borderRadius: 29, overflow: 'hidden', color: palette.green, backgroundColor: palette.mint, fontSize: 25, fontWeight: '700' }}>B</Text><Label>My skincare preferences</Label><Body>Your age range helps personalise ingredient recommendations.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 5 }}>{ageGroups.map((age) => <Text key={age} onPress={() => setAgeGroup(age)} style={[styles.chip, age === ageGroup && styles.chipSelected]}><Text style={[styles.chipText, age === ageGroup && styles.chipTextSelected]}>{age}</Text></Text>)}</View></Card>
    {/* Display server reachability and the active API address. */}
    <Card><View style={styles.row}><Label>Backend connection</Label><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: serverStatus === 'online' ? '#6E9C72' : serverStatus === 'offline' ? '#C46A5E' : palette.gold }} /><Text style={{ color: palette.muted, fontSize: 13, fontWeight: '600' }}>{serverStatus === 'online' ? 'Connected' : serverStatus === 'offline' ? 'Offline' : 'Checking'}</Text></View></View><Body>Analysis API: {API_URL}</Body><Body style={{ fontSize: 12 }}>The backend uses the local skin classifier and OpenCV face detection. Set EXPO_PUBLIC_API_URL to override the Expo Go computer address.</Body></Card>
    <Card><Label>Latest analysis</Label>{analysis ? <><Text style={{ fontSize: 21, color: palette.ink, fontWeight: '700', textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')}</Text><Body>{new Date(analysis.createdAt).toLocaleString()}</Body><Body>Saved for this app session only. Account sync and permanent history are not connected.</Body></> : <Body>You haven’t completed an analysis in this session yet.</Body>}</Card>
    <Card><Label>About Beautilyze</Label><Body>Beautilyze offers skin type estimates and general product suggestions. It does not diagnose skin conditions or replace advice from a qualified professional.</Body></Card>
  </ScrollView></Screen>;
}
