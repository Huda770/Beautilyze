import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PageTitle, fonts, palette, Screen, styles } from '@/components/beautilyze-ui';
import { ROUTINES } from '@/constants/routines';
import { useAppState } from '@/state/app-state';


export default function RoutineScreen() {
  const { routineAssignments } = useAppState();
  return <Screen><ScrollView contentContainerStyle={styles.scroll}>
    <PageTitle eyebrow="Your plan" title="Routines" subtitle="Your products, organised by when to use them." />
    {ROUTINES.map((routine) => {
      const count = routineAssignments[routine.key].length;
      return <Link key={routine.key} href={{ pathname: '/routine-detail', params: { routine: routine.key } }} asChild><Pressable accessibilityRole="button" accessibilityLabel={`${routine.name}, ${count} products`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: palette.line }}><View style={{ width: 76, height: 76, borderRadius: 14, backgroundColor: routine.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34 }}>{routine.icon}</Text></View><View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 18, color: palette.ink, fontFamily: fonts.bold }}>{routine.name}</Text><Text style={{ color: palette.muted }}>{routine.subtitle}</Text><Text style={{ color: palette.muted }}>{count ? `${count} product${count === 1 ? '' : 's'} added` : 'No products yet'}</Text></View><Text style={{ color: palette.muted, fontSize: 24 }}>›</Text></Pressable></Link>;
    })}
  </ScrollView></Screen>;
}
