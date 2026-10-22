import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, palette, Screen, styles } from '@/components/beautilyze-ui';
import { useAppState } from '@/state/app-state';

const categoryOrder = ['cleanser', 'toner', 'treatment', 'serum', 'moisturizer', 'sunscreen'];
const titleCase = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

// Show the latest result and matched products in skincare-step order.
export default function RoutineScreen() {
  const { analysis } = useAppState();
  const products = analysis?.routine || {};
  const categories = [...categoryOrder.filter((category) => products[category]), ...Object.keys(products).filter((category) => !categoryOrder.includes(category))];
  // If there is no analysis yet, guide the user to start one.
  return <Screen><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <PageTitle eyebrow="Your skin journey · 02" title="Your routine" subtitle="A few thoughtful steps, chosen around your skin." />
    {/* Before analysis, offer a direct link; afterwards show the result. */}
    {!analysis ? <Card style={{ alignItems: 'flex-start', paddingVertical: 24 }}><Text style={{ fontSize: 30 }}>✿</Text><Label>Your routine starts with a skin analysis</Label><Body>Share a clear photo and tell us what you’d like help with. We’ll match your result with products in the catalogue.</Body><Link href="/analyze" asChild><Button title="Start analysis" /></Link></Card> : <>
      <Card style={{ backgroundColor: palette.mint, borderColor: '#DDE8DA' }}><Text style={{ color: palette.green, fontWeight: '800', fontSize: 11, letterSpacing: 1.5 }}>YOUR SKIN TYPE</Text><Text style={{ fontSize: 30, fontWeight: '700', color: palette.ink, textTransform: 'capitalize' }}>{titleCase(analysis.skin_type)}</Text>{typeof analysis.confidence === 'number' ? <Body>Model confidence: {(analysis.confidence * 100).toFixed(1)}%</Body> : null}<Body>Based on your selected goals: {analysis.concerns.join(', ')}.</Body></Card>
      {categories.length ? <>{categories.map((category, index) => { const product = products[category]; return <Card key={category}><View style={styles.row}><Text style={{ color: palette.gold, fontWeight: '800', fontSize: 11, letterSpacing: 1.3 }}>STEP {String(index + 1).padStart(2, '0')}</Text><Text style={{ color: palette.green, fontWeight: '700', fontSize: 12 }}>{titleCase(category)}</Text></View><Label>{product.name}</Label>{product.matched_ingredients?.length ? <Body>Matched ingredients: {product.matched_ingredients.join(', ')}</Body> : null}</Card>; })}<Body style={{ fontSize: 12 }}>Product matches are informational. Review ingredients and patch test new products.</Body></> : <Card><Label>No product matches yet</Label><Body>The skin analysis worked, but the backend did not return suitable products for this skin type and these concerns. Check the product catalogue and recommendation data.</Body></Card>}
      <Link href="/analyze" asChild><Button title="Retake analysis" secondary /></Link>
    </>}
  </ScrollView></Screen>;
}
