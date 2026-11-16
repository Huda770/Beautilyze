import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, fonts, palette, Screen, styles } from '@/components/beautilyze-ui';
import { useAppState } from '@/state/app-state';
import { AGE_GROUPS, SKIN_GOALS } from '@/constants/profile-options';

const inputStyle = { minHeight: 50, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, color: palette.ink, fontSize: 15, fontFamily: fonts.regular } as const;

export default function ProfileScreen() {
  const { ageGroup, setAgeGroup, analysis, account, authReady, authError, clearAuthError, signIn, signOut, allergies, setAllergies, concerns, setConcerns } = useAppState();
  const [allergyInput, setAllergyInput] = useState('');
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [registerMode, setRegisterMode] = useState(mode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  
  const [appliedMode, setAppliedMode] = useState(mode);
  if (mode !== appliedMode) {
    setAppliedMode(mode);
    if (mode === 'register' || mode === 'signin') setRegisterMode(mode === 'register');
  }

  function addAllergy() {
    const value = allergyInput.trim();
    if (value && !allergies.some((item) => item.toLowerCase() === value.toLowerCase())) setAllergies([...allergies, value]);
    setAllergyInput('');
  }

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

    {!authReady ? <Card><ActivityIndicator color={palette.accent} /><Body>Checking your account…</Body></Card> : account ? <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: palette.lavender, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: palette.accent, fontSize: 22, fontFamily: fonts.bold }}>{account.email[0]?.toUpperCase()}</Text></View>
      <View style={{ flex: 1, gap: 2 }}><Label>{account.email.split('@')[0].replace(/[._-]/g, ' ')}</Label><Body>{account.email}</Body><Text onPress={handleSignOut} style={{ color: palette.danger, fontSize: 12, fontFamily: fonts.bold, marginTop: 3 }}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></View>
      {authError ? <Body accessibilityRole="alert" style={{ color: palette.danger }}>{authError}</Body> : null}
    </Card> : <Card>
      <Label>{registerMode ? 'Create your account' : 'Welcome back'}</Label>
      <Body>{registerMode ? 'Save your preferences with a secure account.' : 'Sign in to save your skincare preferences.'}</Body>
      <TextInput style={inputStyle} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={palette.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel="Email address" editable={!submitting} />
      <TextInput style={inputStyle} value={password} onChangeText={setPassword} placeholder={registerMode ? 'Password (10 characters or more)' : 'Password'} placeholderTextColor={palette.muted} autoCapitalize="none" autoComplete={registerMode ? 'new-password' : 'current-password'} textContentType={registerMode ? 'newPassword' : 'password'} secureTextEntry accessibilityLabel="Password" editable={!submitting} onSubmitEditing={submitAuth} />
      {formError || authError ? <Body accessibilityRole="alert" style={{ color: palette.danger }}>{formError || authError}</Body> : null}
      <Button title={submitting ? (registerMode ? 'Creating account…' : 'Signing in…') : (registerMode ? 'Create account' : 'Sign in')} disabled={submitting || !email.trim() || !password} onPress={submitAuth} />
      <Text onPress={() => { setRegisterMode((value) => !value); setFormError(''); clearAuthError(); }} accessibilityRole="button" style={{ color: palette.accent, textAlign: 'center', paddingVertical: 6, fontFamily: fonts.bold }}>
        {registerMode ? 'Already have an account? Sign in' : 'New to Beautilyze? Create an account'}
      </Text>
    </Card>}

    <Card><Label>My skincare preferences</Label><Body>Age range</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{AGE_GROUPS.map((age) => <Pressable key={age} onPress={() => setAgeGroup(age)} accessibilityRole="button" accessibilityState={{ selected: age === ageGroup }} style={[styles.chip, age === ageGroup && styles.chipSelected]}><Text style={[styles.chipText, age === ageGroup && styles.chipTextSelected]}>{age}</Text></Pressable>)}</View>

    <View style={{ gap: 8, borderTopWidth: 1, borderColor: palette.line, paddingTop: 12 }}><Label>Skin goals</Label><Body>Choose the goals you want product suggestions to focus on.</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{SKIN_GOALS.map((goal) => { const selected = concerns.includes(goal); return <Pressable key={goal} onPress={() => setConcerns(selected ? concerns.filter((item) => item !== goal) : [...concerns, goal])} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{goal}</Text></Pressable>; })}</View></View>

    <View style={{ gap: 6, borderTopWidth: 1, borderColor: palette.line, paddingTop: 12 }}><Label>Allergies and sensitivities</Label><Body>Add ingredients to exclude them from recommendations.</Body>
      <TextInput placeholder="e.g. Niacinamide" value={allergyInput} onChangeText={setAllergyInput} onSubmitEditing={addAllergy} style={inputStyle} />
      <Pressable accessibilityRole="button" onPress={addAllergy}><Text style={{ color: palette.accent, fontFamily: fonts.bold }}>+ Add ingredient</Text></Pressable>
      {allergies.map((item) => <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}><Text style={{ color: palette.ink }}>{item}</Text><Pressable accessibilityRole="button" onPress={() => setAllergies(allergies.filter((value) => value !== item))}><Text style={{ color: palette.danger }}>Remove</Text></Pressable></View>)}
      <Body style={{ fontSize: 12, marginTop: 8 }}>Ingredient exclusions are saved on this device. Catalogue ingredient lists are incomplete; review the complete product label.</Body>
    </View></Card>

    <Card><Label>Latest analysis</Label>{analysis ? <><Text style={{ fontSize: 21, color: palette.ink, fontFamily: fonts.serif, textTransform: 'capitalize' }}>{analysis.skin_type.replaceAll('-', ' ')}</Text><Body>{new Date(analysis.createdAt).toLocaleString()}</Body><Body>Your latest analysis is saved on this device.</Body></> : <Body>You haven’t completed an analysis yet.</Body>}</Card>
    <Card><Label>About Beautilyze</Label><Body>Beautilyze offers skin type estimates and general product suggestions. Photo-based results are not medical diagnoses.</Body></Card>
  </ScrollView></Screen>;
}
