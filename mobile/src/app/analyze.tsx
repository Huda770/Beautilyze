import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { API_URL } from '@/constants/api';
import { useAppState } from '@/state/app-state';

const ageGroups = ['14-18', '19-25', '26-35', '36-45', '45+'];
const concernOptions = ['Acne', 'Dark Circles', 'Hyperpigmentation', 'Dullness', 'Sun Tan', 'Uneven Skin Tone', 'Dehydrated Skin', 'Texture Issues', 'Oil Control', 'No Skin Concerns'];

// Collect a photo and preferences, then send them to the Python API.
export default function AnalyzeScreen() {
  const { ageGroup, setAgeGroup, setAnalysis, allergies } = useAppState();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Ask permission and open either the camera or photo library.
  async function choosePhoto(camera = false) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', camera ? 'Allow camera access to take a skin photo.' : 'Allow photo access to choose a skin photo.');
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
    if (!result.canceled) { setPhoto(result.assets[0]); setMessage(''); setAnalysis(null); }
  }

  // Keep “No Skin Concerns” exclusive from the other choices.
  function toggleConcern(value: string) {
    if (value === 'No Skin Concerns') { setConcerns(concerns.includes(value) ? [] : [value]); return; }
    setConcerns((current) => current.filter((item) => item !== 'No Skin Concerns').includes(value)
      ? current.filter((item) => item !== value && item !== 'No Skin Concerns')
      : [...current.filter((item) => item !== 'No Skin Concerns'), value]);
  }

  // Upload the image and save the result for the Routine screen.
  async function submit() {
    if (!photo) { setMessage('Choose a clear, well-lit photo of your face to continue.'); return; }
    if (concerns.length === 0) { setMessage('Choose at least one skin concern, or select “No Skin Concerns”.'); return; }
    setLoading(true); setMessage('');
    try {
      const form = new FormData();
      form.append('image', new File(photo.uri) as unknown as Blob);
      form.append('age_group', ageGroup);
      form.append('concerns', JSON.stringify(concerns));
      form.append('allergies', JSON.stringify(allergies));
      const response = await expoFetch(`${API_URL}/predict`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'We could not analyze this photo. Try another clear face photo.');
      setAnalysis({
        skin_type: data.skin_type,
        confidence: data.confidence,
        routine: data.routine || {},
        createdAt: new Date().toISOString(),
        ageGroup,
        concerns,
        allergies: [...allergies],
      });
      setMessage('Your skin analysis is ready. Open Routine to see your results.');
    } catch (error) {
      setMessage(error instanceof Error && (error.message.includes('Network request failed') || error.message.includes('fetch'))
        ? `Can't reach the backend at ${API_URL}. Start the Python server and set EXPO_PUBLIC_API_URL to your computer's Wi-Fi address.`
        : error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="Your skin journey · 01" title="Let’s understand your skin" subtitle="A clear, front-facing photo helps us build a more personal routine." />
    {/* Choose a photo or take one with the camera. */}
    <Card style={{ backgroundColor: '#F0E9DF', overflow: 'hidden' }}>
      <Label>Your photo</Label>
      <Body>Use natural light and remove glasses or heavy makeup if possible.</Body>
      {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 260, borderRadius: 15, marginTop: 5 }} resizeMode="cover" /> : <View style={{ minHeight: 142, borderRadius: 15, backgroundColor: '#E5E0D6', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Text style={{ fontSize: 34 }}>⌁</Text><Text style={{ color: palette.muted }}>Your photo preview will appear here</Text></View>}
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Button title="Choose photo" onPress={() => choosePhoto(false)} /></View><View style={{ flex: 1 }}><Button title="Take photo" secondary onPress={() => choosePhoto(true)} /></View></View>
    </Card>
    {/* Choose an age range and any skin concerns for recommendations. */}
    <Card><Label>Age range</Label><Body>Used to tailor ingredient suggestions.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{ageGroups.map((age) => <Text key={age} onPress={() => setAgeGroup(age)} style={[styles.chip, age === ageGroup && styles.chipSelected, { overflow: 'hidden' }]}>{<Text style={[styles.chipText, age === ageGroup && styles.chipTextSelected]}>{age}</Text>}</Text>)}</View></Card>
    <Card><Label>What would you like help with?</Label><Body>Choose all that apply.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{concernOptions.map((item) => { const selected = concerns.includes(item); return <Text key={item} onPress={() => toggleConcern(item)} style={[styles.chip, selected && styles.chipSelected, { overflow: 'hidden' }]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item}</Text></Text>; })}</View></Card>
    <Card><Label>Allergies and sensitivities</Label><Body>{allergies.length ? `Ingredients to exclude: ${allergies.join(', ')}.` : 'No ingredient exclusions added. Add allergies or sensitivities in Profile before analyzing.'}</Body><Body>Filters use the ingredients recorded in our catalogue. Full ingredient labels are not yet available.</Body></Card>
    {/* Show errors or the success message, then allow a new submission. */}
    {message ? <Card style={{ backgroundColor: message.startsWith('Your skin') ? palette.mint : '#F8E9E5', borderColor: 'transparent' }}><Body style={{ color: message.startsWith('Your skin') ? palette.greenDark : palette.danger }}>{message}</Body></Card> : null}
    <Button title={loading ? 'Analyzing your photo…' : 'Analyze my skin'} disabled={loading} onPress={submit} />
    {loading ? <ActivityIndicator color={palette.green} /> : null}
    <Body style={{ textAlign: 'center', fontSize: 12 }}>Your photo is sent to your Beautilyze backend for analysis.</Body>
  </ScrollView></Screen>;
}
