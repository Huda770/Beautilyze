import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, fonts, palette, Screen, styles } from '@/components/beautilyze-ui';
import { explainProduct, iconFor, titleCase } from '@/constants/products';
import { ROUTINES } from '@/constants/routines';
import { isSameProduct, useAppState } from '@/state/app-state';

export default function ReportScreen() {
  const { analysis, routineAssignments, addToRoutine } = useAppState();
  const [picking, setPicking] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});
  if (!analysis) return <Screen><ScrollView contentContainerStyle={styles.scroll}>
    <PageTitle eyebrow="Your results" title="Your skin report" />
    <Card><Label>No report yet</Label><Body>Complete a skin analysis to see your skin type and recommended products.</Body><Link href="/analyze" asChild><Button title="Go to Analyze" /></Link></Card>
  </ScrollView></Screen>;

  const products = Object.entries(analysis.routine || {});
  const concernNotes = Object.entries(analysis.explanations?.selected_concerns || {});
  return <Screen><ScrollView contentContainerStyle={styles.scroll}>
    <PageTitle eyebrow={`Your results · ${new Date(analysis.createdAt).toLocaleDateString()}`} title="Your skin report" subtitle="A photo based estimate with product suggestions picked for your preferences." />
    <Card style={{ backgroundColor: '#E8CED1', minHeight: 190, padding: 18 }}>
      <View style={[styles.row, { alignItems: 'stretch', gap: 12 }]}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
          <Label style={{ fontSize: 24 }}>{titleCase(analysis.skin_type)} skin</Label>
          <Body style={{ color: palette.ink }}>{analysis.explanations?.skin_type || 'An estimate from your photo, not a medical assessment.'}</Body>
          {analysis.note ? <Body style={{ color: palette.ink }}>{analysis.note}</Body> : null}
        </View>
        <Image source={skinTypeImage(analysis.skin_type)} style={{ width: 95, height: 113, borderRadius: 18, backgroundColor: palette.cream }} resizeMode="cover" />
      </View>
    </Card>
    <Card><Label>Skin goals</Label>{!concernNotes.length ? <Body>{analysis.concerns.join(', ') || 'None selected'}</Body> : null}
      {concernNotes.map(([concern, note]) => <Body key={concern}><Text style={{ fontFamily: fonts.bold }}>{titleCase(concern)}: </Text>{note}</Body>)}
    </Card>
    <Label>Recommended products</Label>
    {analysis.recommendation_note ? <Body>{analysis.recommendation_note}</Body> : null}
    {products.map(([category, product]) => {
      const explanation = explainProduct(category, product, analysis);
      const item = { ...product, category: product.category || category };
      const inRoutines = ROUTINES.filter((r) => routineAssignments[r.key].some((p) => isSameProduct(p, item)));
      return <Card key={category}>
        <View style={[styles.row, { justifyContent: 'flex-start', gap: 10 }]}>{productTypeImage(category) ? <Image source={productTypeImage(category)!} style={{ width: 56, height: 56 }} resizeMode="contain" /> : <Text style={{ fontSize: 28 }}>{iconFor(category)}</Text>}<Text style={{ color: palette.accent, fontFamily: fonts.bold }}>{titleCase(category)}</Text></View>
        <Label>{product.name}</Label>
        <Body>{explanation}</Body>
        {inRoutines.length ? <Body style={{ color: palette.plum }}>✓ In your {inRoutines.map((r) => r.key.toLowerCase()).join(', ')} routine</Body> : null}
        {notice[category] ? <Body style={{ color: palette.accentDark }}>{notice[category]}</Body> : null}
        {picking === category ? <View style={{ gap: 8 }}>
          <Body>Add this product to:</Body>
          {ROUTINES.map((routine) => {
            const already = inRoutines.includes(routine);
            return <Button key={routine.key} title={already ? `${routine.key} ✓ added` : routine.key} secondary disabled={already} onPress={() => {
              const added = addToRoutine(routine.key, item, explanation);
              setNotice({ ...notice, [category]: added ? `Added to your ${routine.key.toLowerCase()} routine.` : `Already in your ${routine.key.toLowerCase()} routine.` });
              setPicking(null);
            }} />;
          })}
          <Button title="Cancel" secondary onPress={() => setPicking(null)} />
        </View> : <Button title={inRoutines.length === ROUTINES.length ? 'In all routines' : 'Add to routine'} disabled={inRoutines.length === ROUTINES.length} onPress={() => setPicking(category)} />}
      </Card>;
    })}
    {!products.length ? <Card><Body>{analysis.recommendation_note ? 'Try adjusting your goals or exclusions in Profile.' : 'No product matches found for your preferences.'}</Body></Card> : null}
  </ScrollView></Screen>;
}

function skinTypeImage(skinType: string) {
  const type = skinType.toLowerCase();
  if (type.includes('oily')) return require('../../assets/images/skin-oily.jpg');
  if (type.includes('combination')) return require('../../assets/images/skin-combination.jpg');
  if (type.includes('dry')) return require('../../assets/images/skin-dry.jpg');
  return require('../../assets/images/skin-combination.jpg');
}

function productTypeImage(category: string) {
  const value = category.toLowerCase();
  if (value.includes('serum')) return require('../../assets/images/serum.jpg');
  if (value.includes('toner')) return require('../../assets/images/toner.jpg');
  if (value.includes('treatment')) return require('../../assets/images/treatment.jpg');
  return null;
}
