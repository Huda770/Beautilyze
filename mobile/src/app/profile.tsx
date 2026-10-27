import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import {ScrollView, Text, View, TextInput, Pressable} from 'react-native';
import { Body, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { API_URL } from '@/constants/api';
import { useAppState } from '@/state/app-state';

const ageGroups = ['14-18', '19-25', '26-35', '36-45', '45+'];
const inputStyle = { minHeight: 50, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, color: palette.ink, fontSize: 15 } as const;

export default function ProfileScreen() {
  const { ageGroup, setAgeGroup, analysis, account, authReady, authError, clearAuthError, signIn, signOut } = useAppState();
  const { ageGroup, setAgeGroup, analysis, allergies, setAllergies } = useAppState();

  const [allergyInput, setAllergyInput] = useState('');

  const addAllergy = () => {
    const value = allergyInput.trim();

    if (value && !allergies.some(
      item => item.toLowerCase() === value.toLowerCase()
    )) {
      setAllergies([...allergies, value]);
    }

    setAllergyInput('');
  };

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_URL}/health`).then(async (response) => {
      const health = await response.json();
      if (mounted) setServerStatus(response.ok && health.status === 'ok' ? 'online' : 'offline');
    }).catch(() => { if (mounted) setServerStatus('offline'); });
    return () => { mounted = false; };
  }, []);

  async function submitAuth() {
    setFormError('');
    clearAuthError();
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, registerMode);
      setPassword('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not complete your request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }

  return <Screen><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="A little about you" title="Your profile" subtitle="Keep your skincare preferences and account together." />

    {!authReady ? <Card><ActivityIndicator color={palette.green} /><Body>Checking your account…</Body></Card> : account ? <Card>
      <Label>Your Beautilyze account</Label>
      <Body>{account.email}</Body>
      <Body>Your session is protected on this device. Your age range is saved to your account.</Body>
      {authError ? <Body accessibilityRole="alert" style={{ color: palette.danger }}>{authError}</Body> : null}
      <Button title={signingOut ? 'Signing out…' : 'Sign out'} secondary disabled={signingOut} onPress={handleSignOut} />
    </Card> : <Card>
      <Label>{registerMode ? 'Create your account' : 'Welcome back'}</Label>
      <Body>{registerMode ? 'Save your preferences with a secure account.' : 'Sign in to save your skincare preferences.'}</Body>
      <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={palette.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel="Email address" editable={!submitting} />
      <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder={registerMode ? 'Password (10 characters or more)' : 'Password'} placeholderTextColor={palette.muted} autoCapitalize="none" autoComplete={registerMode ? 'new-password' : 'current-password'} textContentType={registerMode ? 'newPassword' : 'password'} secureTextEntry accessibilityLabel="Password" editable={!submitting} onSubmitEditing={submitAuth} />
      {formError || authError ? <Body accessibilityRole="alert" style={{ color: palette.danger }}>{formError || authError}</Body> : null}
      <Button title={submitting ? (registerMode ? 'Creating account…' : 'Signing in…') : (registerMode ? 'Create account' : 'Sign in')} disabled={submitting || !email.trim() || !password} onPress={submitAuth} />
      <Text onPress={() => { setRegisterMode((value) => !value); setFormError(''); clearAuthError(); }} accessibilityRole="button" style={{ color: palette.green, textAlign: 'center', paddingVertical: 6, fontWeight: '700' }}>
        {registerMode ? 'Already have an account? Sign in' : 'New to Beautilyze? Create an account'}
      </Text>
    </Card>}

    <Card><Label>My skincare preferences</Label><Body>Your age range helps personalise ingredient recommendations{account ? ' and is saved to your account.' : '.'}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 5 }}>{ageGroups.map((age) => <Text key={age} onPress={() => setAgeGroup(age)} accessibilityRole="button" style={[styles.chip, age === ageGroup && styles.chipSelected]}><Text style={[styles.chipText, age === ageGroup && styles.chipTextSelected]}>{age}</Text></Text>)}</View></Card>

  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="A little about you" title="Your profile" subtitle="Set your preferences and check your app connection." />
    {/* Age preference is reused on the Analyze screen. */}
    <Card><Text style={{ width: 58, height: 58, lineHeight: 58, textAlign: 'center', borderRadius: 29, overflow: 'hidden', color: palette.green, backgroundColor: palette.mint, fontSize: 25, fontWeight: '700' }}>B</Text><Label>My skincare preferences</Label><Body>Your age range helps personalise ingredient recommendations.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 5 }}>{ageGroups.map((age) => <Text key={age} onPress={() => setAgeGroup(age)} style={[styles.chip, age === ageGroup && styles.chipSelected]}><Text style={[styles.chipText, age === ageGroup && styles.chipTextSelected]}>{age}</Text></Text>)}</View></Card>
    <Card>
  <Label>Allergies and sensitivities</Label>
  <Body>Add any ingredient you are allergic or sensitive to, one at a time. Products containing a listed ingredient will be excluded from recommendations. Changes hide your previous routine; run a new analysis to refresh it.</Body>

  <TextInput
    placeholder="e.g. Niacinamide"
    value={allergyInput}
    onChangeText={setAllergyInput}
    style={{
      borderWidth: 1,
      borderColor: '#cccccc',
      borderRadius: 8,
      padding: 12,
      marginVertical: 10,
      color: '#222222',
    }}
  />

  <Pressable onPress={addAllergy}>
    <Text style={{ color: '#27865A', fontWeight: 'bold' }}>
      + Add ingredient
    </Text>
  </Pressable>

  {allergies.map((item) => (
    <View key={item} style={{ marginTop: 8 }}>
      <Text>
        {item}{' '}
        <Text
          onPress={() =>
            setAllergies(allergies.filter(a => a !== item))
          }
          style={{ color: 'red' }}
        >
          Remove
        </Text>
      </Text>
    </View>
  ))}
</Card>


    <Card><Label>Ingredient filtering</Label><Body>Preferences are saved for this app session. Filtering checks recorded ingredient names, including case and punctuation differences. Alternate ingredient names must be added separately. The catalogue contains selected ingredients, so review the complete product label before use.</Body></Card>
    {/* Display server reachability and the active API address. */}
    <Card><View style={styles.row}><Label>Backend connection</Label><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: serverStatus === 'online' ? '#6E9C72' : serverStatus === 'offline' ? '#C46A5E' : palette.gold }} /><Text style={{ color: palette.muted, fontSize: 13, fontWeight: '600' }}>{serverStatus === 'online' ? 'Connected' : serverStatus === 'offline' ? 'Offline' : 'Checking'}</Text></View></View><Body>Analysis API: {API_URL}</Body><Body style={{ fontSize: 12 }}>The backend uses the local skin classifier and OpenCV face detection. Set EXPO_PUBLIC_API_URL to override the Expo Go computer address.</Body></Card>

    <Card><Label>Latest analysis</Label>{analysis ? <><Text style={{ fontSize: 21, color: palette.ink, fontWeight: '700', textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')}</Text><Body>{new Date(analysis.createdAt).toLocaleString()}</Body><Body>Saved for this app session.</Body></> : <Body>You haven’t completed an analysis in this session yet.</Body>}</Card>
    <Card><Label>About Beautilyze</Label><Body>Beautilyze offers skin type estimates and general product suggestions. It does not diagnose skin conditions or replace advice from a qualified professional.</Body></Card>
  </ScrollView></Screen>;
}
