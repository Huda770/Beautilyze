import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Label, PageTitle, fonts, palette, Screen, styles } from '@/components/beautilyze-ui';
import { ROUTINES, isRoutineKey } from '@/constants/routines';
import { titleCase } from '@/constants/products';
import { useAppState } from '@/state/app-state';

export default function RoutineDetailScreen() {
  const params = useLocalSearchParams<{ routine?: string }>();
  const key = isRoutineKey(params.routine) ? params.routine : 'Morning';
  const routine = ROUTINES.find((item) => item.key === key)!;
  const { routineAssignments, removeFromRoutine, analysis } = useAppState();
  const products = routineAssignments[key];
  return <Screen><Stack.Screen options={{ title: routine.name }} /><ScrollView contentContainerStyle={styles.scroll}>
    <PageTitle eyebrow={`${routine.icon}  ${routine.subtitle}`} title={routine.name} subtitle="Products you added from your skin report." />
    {products.length ? products.map((product, index) => <Card key={`${product.category}-${product.name}`}>
      <Text style={{ color: palette.plum, fontFamily: fonts.bold }}>STEP {index + 1} · {titleCase(product.category).toUpperCase()}</Text>
      <Label>{product.name}</Label>
      {product.explanation ? <Body>{product.explanation}</Body> : null}
      <Body>Use according to the product label and your skin’s tolerance.</Body>
      <Button title="Remove from routine" secondary onPress={() => removeFromRoutine(key, product)} />
    </Card>) : <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: routine.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 30 }}>{routine.icon}</Text></View>
      <Label style={{ textAlign: 'center' }}>No products added yet</Label>
      <Body style={{ textAlign: 'center' }}>{analysis ? 'Open your skin report and tap “Add to routine” on a product.' : 'Analyze your skin to get product suggestions, then add them here from your report.'}</Body>
      <Link href={analysis ? '/report' : '/analyze'} asChild><Button title={analysis ? 'Open my skin report' : 'Go to Analyze'} secondary /></Link>
    </Card>}
  </ScrollView></Screen>;
}
