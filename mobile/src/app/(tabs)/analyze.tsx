import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Body, Button, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { API_URL } from '@/constants/api';
import { useAppState } from '@/state/app-state';

export default function AnalyzeScreen() {
  const { ageGroup, allergies, concerns, analysis, setAnalysis } = useAppState();
  // The report widget appears once this screen has produced a successful analysis.
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function choosePhoto(camera = false) {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', camera ? 'Allow camera access to take a skin photo.' : 'Allow photo access to choose a skin photo.');
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
    if (!result.canceled) { setPhoto(result.assets[0]); setMessage(''); }
  }

  async function submit() {
    if (!photo) { setMessage('Choose a clear, well-lit photo of your face to continue.'); return; }
    if (!concerns.length) { setMessage('Choose your skin goals in Profile before analyzing.'); return; }
    setLoading(true); setMessage('');
    try {
      const form = new FormData();
      form.append('image', new File(photo.uri) as unknown as Blob);
      form.append('age_group', ageGroup);
      form.append('concerns', JSON.stringify(concerns));
      form.append('allergies', JSON.stringify(allergies));
      const response = await expoFetch(`${API_URL}/predict`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not analyze this photo. Try another clear face photo.');
      setAnalysis({
        skin_type: data.skin_type, confidence: data.confidence, result_reliable: data.result_reliable,
        note: data.note, recommendation_note: data.recommendation_note, explanations: data.explanations,
        preferredCategories: data.preferred_categories || [],
        routine: data.routine || {}, createdAt: new Date().toISOString(), ageGroup,
        concerns, allergies: [...allergies],
      });
      setMessage('Your skin analysis is ready. Tap your report below to see your recommended products.');
    } catch (error) {
      setMessage(error instanceof Error && (error.message.includes('Network request failed') || error.message.includes('fetch'))
        ? `Can't reach the backend at ${API_URL}. Start the Python server and set EXPO_PUBLIC_API_URL to your computer's Wi-Fi address.`
        : error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="Your skin journey · 01" title="Let’s understand your skin" subtitle="A clear, front-facing photo helps us build a more personal routine." />
    <Card style={{ backgroundColor: palette.soft, overflow: 'hidden' }}>
      <Label>Your photo</Label><Body>Use natural light and remove glasses or heavy makeup if possible.</Body>
      {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 260, borderRadius: 15, marginTop: 5 }} resizeMode="cover" /> : <View style={{ minHeight: 142, borderRadius: 15, backgroundColor: palette.lavender, alignItems: 'center', justifyContent: 'center', gap: 7 }}><Text style={{ fontSize: 34 }}>⌁</Text><Text style={{ color: palette.muted }}>Your photo preview will appear here</Text></View>}
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Button title="Choose photo" onPress={() => choosePhoto(false)} /></View><View style={{ flex: 1 }}><Button title="Take photo" secondary onPress={() => choosePhoto(true)} /></View></View>
    </Card>
    <Card><Label>Your saved preferences</Label><Body>Age range: {ageGroup}. Skin goals: {concerns.join(', ') || 'none selected'}. {allergies.length ? `Ingredient exclusions: ${allergies.join(', ')}.` : 'No ingredient exclusions added.'}</Body><Link href="/profile" asChild><Button title="Edit profile preferences" secondary /></Link></Card>
    {message ? <Card style={{ backgroundColor: message.startsWith('Your skin') ? palette.soft : '#F8E4DD', borderColor: 'transparent' }}><Body style={{ color: message.startsWith('Your skin') ? palette.accentDark : palette.danger }}>{message}</Body></Card> : null}
    <Button title={loading ? 'Analyzing your photo…' : 'Analyze my skin'} disabled={loading} onPress={submit} />
    {analysis ? <Link href="/report" asChild><Pressable accessibilityRole="button" style={{ borderRadius: 20, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, padding: 18, gap: 6 }}><Text style={{ color: palette.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 }}>YOUR SKIN REPORT</Text><Text style={{ color: palette.ink, fontSize: 24, fontFamily: 'DMSerifDisplay_400Regular', textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')} skin</Text><Text style={{ color: palette.muted }}>Tap to view your personalised products →</Text></Pressable></Link> : null}
    {loading ? <ActivityIndicator color={palette.accent} /> : null}
    <Body style={{ textAlign: 'center', fontSize: 12 }}>Your photo is sent to your Beautilyze backend for analysis.</Body>
  </ScrollView></Screen>;
}
