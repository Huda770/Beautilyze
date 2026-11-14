import { View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

// Brand tones taken from the selected logo and concept: cream, blush, mauve, and soft lavender.
export const brand = {
  cream: '#FDF8F6', blush: '#F6E4E3', petal: '#EFC9C6', rose: '#B98088', mauve: '#61435C', plum: '#65427B',
  lavender: '#E9E1F2', lilac: '#B9A3D1', ink: '#3C2633', muted: '#6F6370', line: '#EADDDB', white: '#FFFFFF',
  shelf: '#F1E4DE',
};

// Every shape is placed in units of the scene width so the drawing scales cleanly on any screen.
type Box = { x: number; y: number; w: number; h: number };
const place = (u: number, { x, y, w, h }: Box): ViewStyle => ({ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u });

// A lavender sprig drawn from a stem and small alternating buds, like the botanical references.
function Sprig({ u, x, y, length, angle, color = brand.lilac }: { u: number; x: number; y: number; length: number; angle: number; color?: string }) {
  const buds = Math.round(length / 0.035);
  return <View pointerEvents="none" style={[place(u, { x, y, w: 0.06, h: length }), { transform: [{ rotate: `${angle}deg` }], transformOrigin: 'bottom' }]}>
    <View style={{ position: 'absolute', left: 0.029 * u, top: 0, width: 1.5, height: length * u, backgroundColor: '#9C8A9E' }} />
    {Array.from({ length: buds }, (_, index) => index < buds * 0.55 ? <View key={index} style={{
      position: 'absolute', top: index * 0.032 * u, left: (index % 2 ? 0.032 : 0.008) * u, width: 0.022 * u, height: 0.034 * u,
      borderRadius: 0.012 * u, backgroundColor: color, opacity: 0.6 + (index % 3) * 0.13, transform: [{ rotate: index % 2 ? '24deg' : '-24deg' }],
    }} /> : null)}
  </View>;
}

// A soft leaf echoing the leaf in the Beautilyze logo.
function Leaf({ u, x, y, size, angle, color = brand.rose }: { u: number; x: number; y: number; size: number; angle: number; color?: string }) {
  return <View pointerEvents="none" style={[place(u, { x, y, w: size, h: size * 0.55 }), {
    backgroundColor: color, opacity: 0.55, borderTopLeftRadius: size * u, borderBottomRightRadius: size * u, transform: [{ rotate: `${angle}deg` }],
  }]}><View style={{ position: 'absolute', left: '12%', right: '12%', top: '50%', height: 1, backgroundColor: brand.cream, opacity: 0.7 }} /></View>;
}

// The skin-analysis scene: an illustrated face in a scan frame, with a small skincare still life on the shelf.
export function ScanScene({ width, reduceMotion }: { width: number; reduceMotion: boolean }) {
  const u = width;
  const frame = { x: 0.33, y: 0.13, w: 0.34, h: 0.38 };
  const corner = (horizontal: 'left' | 'right', vertical: 'top' | 'bottom'): ViewStyle => ({
    position: 'absolute', width: 0.06 * u, height: 0.06 * u, borderColor: brand.plum, [horizontal]: 0, [vertical]: 0,
    [`border${horizontal === 'left' ? 'Left' : 'Right'}Width`]: 2, [`border${vertical === 'top' ? 'Top' : 'Bottom'}Width`]: 2,
    [`border${vertical === 'top' ? 'Top' : 'Bottom'}${horizontal === 'left' ? 'Left' : 'Right'}Radius`]: 0.02 * u,
  });

  return <View accessible accessibilityRole="image" accessibilityLabel="Illustrated portrait inside a scanning frame, beside a moisturizer jar, a cleanser, and a serum dropper bottle." style={{ width: u, height: 0.86 * u }}>
    {/* Quiet halo and botanical accents behind everything else. */}
    <View style={[place(u, { x: 0.2, y: 0.03, w: 0.6, h: 0.6 }), { borderRadius: 0.3 * u, backgroundColor: brand.lavender, opacity: 0.7 }]} />
    <Sprig u={u} x={0.03} y={0.4} length={0.3} angle={-10} />
    <Sprig u={u} x={0.9} y={0.42} length={0.28} angle={12} />
    <Leaf u={u} x={0.885} y={0.66} size={0.1} angle={-30} />

    {/* The supplied illustrated portrait, cut out from its background, with the shoulders fading into the scene. */}
    <Image source={require('@/assets/images/onboarding-face.png')} contentFit="contain" style={{ position: 'absolute', left: 0.224 * u, top: 0.07 * u, width: 0.552 * u, height: 0.56 * u }} />

    {/* The scan frame, moving scan line, and a few subtle analysis points. */}
    <View style={place(u, frame)}>
      {(['top', 'bottom'] as const).flatMap((vertical) => (['left', 'right'] as const).map((horizontal) => <View key={vertical + horizontal} style={corner(horizontal, vertical)} />))}
    </View>

    {/* A balanced still life on one shelf: cleanser and moisturizer on the left, serum dropper on the right. */}
    <View style={[place(u, { x: 0.02, y: 0.745, w: 0.96, h: 0.06 }), { borderRadius: 0.03 * u, backgroundColor: brand.shelf }]} />
    <View style={[place(u, { x: 0.14, y: 0.53, w: 0.085, h: 0.23 }), { borderRadius: 0.02 * u, backgroundColor: brand.white, borderWidth: 1, borderColor: brand.line }]}>
      <View style={{ position: 'absolute', left: '15%', right: '15%', top: '40%', height: 0.05 * u, borderRadius: 3, backgroundColor: brand.lavender }} />
    </View>
    <View style={[place(u, { x: 0.165, y: 0.49, w: 0.035, h: 0.045 }), { backgroundColor: brand.mauve, borderTopLeftRadius: 0.008 * u, borderTopRightRadius: 0.008 * u }]} />
    <View style={[place(u, { x: 0.175, y: 0.475, w: 0.06, h: 0.018 }), { backgroundColor: brand.mauve, borderRadius: 0.006 * u }]} />
    <View style={[place(u, { x: 0.05, y: 0.665, w: 0.17, h: 0.09 }), { backgroundColor: brand.blush, borderRadius: 0.025 * u, borderWidth: 1, borderColor: brand.petal }]} />
    <View style={[place(u, { x: 0.045, y: 0.635, w: 0.18, h: 0.04 }), { backgroundColor: brand.rose, borderRadius: 0.014 * u }]} />
    <View style={[place(u, { x: 0.095, y: 0.59, w: 0.07, h: 0.045 }), { backgroundColor: brand.white, borderRadius: 0.012 * u, borderWidth: 1, borderColor: brand.line }]} />
    <View style={[place(u, { x: 0.1, y: 0.565, w: 0.06, h: 0.035 }), { backgroundColor: brand.lilac, borderTopLeftRadius: 0.012 * u, borderTopRightRadius: 0.012 * u }]} />
    <View style={[place(u, { x: 0.8, y: 0.6, w: 0.085, h: 0.155 }), { backgroundColor: '#8C6F8F', borderRadius: 0.018 * u, opacity: 0.9 }]}>
      <View style={{ position: 'absolute', left: '18%', right: '18%', top: '35%', height: 0.045 * u, borderRadius: 2, backgroundColor: brand.cream, opacity: 0.85 }} />
    </View>
    <View style={[place(u, { x: 0.815, y: 0.565, w: 0.055, h: 0.04 }), { backgroundColor: brand.ink, borderRadius: 0.006 * u }]} />
    <View style={[place(u, { x: 0.822, y: 0.515, w: 0.041, h: 0.055 }), { backgroundColor: brand.mauve, borderTopLeftRadius: 0.02 * u, borderTopRightRadius: 0.02 * u }]} />
  </View>;
}
