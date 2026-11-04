// These values match the age groups and product categories supported by the backend.
export const AGE_GROUPS = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45 and above',
  'Prefer not to say',
] as const;

// Read from the current skincare.db product catalogue: no unsupported categories are offered.
export const PRODUCT_CATEGORIES = [
  'cleanser',
  'moisturizer',
  'serum',
  'sunscreen',
  'toner',
  'treatment',
] as const;

export const SKIN_GOALS = [
  'Acne',
  'Dark Circles',
  'Dark Spots',
  'Dullness',
  'Hyperpigmentation',
  'Open Pores',
  'Redness',
  'Sun Tan',
  'Whiteheads / Blackheads',
  'Wrinkles',
  'No Skin Concerns',
] as const;
