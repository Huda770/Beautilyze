import type { Analysis, ProductRecommendation } from '@/state/app-state';

export const titleCase = (value: string) => value.replaceAll('-', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const iconFor = (category: string) => {
  const c = category.toLowerCase();
  return c.includes('clean') ? '🫧' : c.includes('moist') || c.includes('cream') ? '🧴' : c.includes('sun') || c.includes('spf') ? '☀️' : c.includes('mask') ? '🌿' : '✨';
};

const categoryPurpose = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('clean')) return 'A cleanser removes oil, sunscreen and buildup so the rest of your routine can work.';
  if (c.includes('moist') || c.includes('cream')) return 'A moisturizer supports your skin barrier and keeps hydration in.';
  if (c.includes('sun') || c.includes('spf')) return 'Daily sunscreen protects against UV damage, dark spots and early ageing. Use it every morning.';
  if (c.includes('serum') || c.includes('treat')) return 'A treatment step targets specific concerns with concentrated active ingredients.';
  if (c.includes('ton')) return 'A toner rebalances skin after cleansing and preps it for the next steps.';
  if (c.includes('mask') || c.includes('exfol')) return 'A weekly step for a deeper treatment; avoid overusing it.';
  return `A ${titleCase(category).toLowerCase()} step for your routine.`;
};

/** A plain-language explanation of why a recommended product suits this analysis. */
export function explainProduct(category: string, product: ProductRecommendation, analysis: Analysis) {
  const skin = analysis.skin_type.replaceAll('-', ' ');
  const parts = [categoryPurpose(category)];
  parts.push(product.matched_ingredients?.length
    ? `It contains ${product.matched_ingredients.join(', ')}, matched to your ${skin} skin and goals${analysis.concerns.length ? ` (${analysis.concerns.join(', ')})` : ''}.`
    : `It was picked for ${skin} skin${analysis.concerns.length ? ` and your goals: ${analysis.concerns.join(', ')}` : ''}.`);
  if (analysis.allergies.length) parts.push(`Filtered to avoid: ${analysis.allergies.join(', ')}.`);
  return parts.join(' ');
}
