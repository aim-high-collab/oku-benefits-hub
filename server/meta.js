// Single source of truth for enumerations. Served to the client via /api/meta.

export const CATEGORIES = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  grocery: 'Grocery & supermarket',
  retail: 'Retail & shopping',
  healthcare: 'Healthcare & pharmacy',
  transport: 'Transport',
  attraction: 'Attraction & museum',
  entertainment: 'Entertainment & leisure',
  hotel: 'Hotel & stay',
  education: 'Education & training',
  services: 'Services',
  other: 'Other',
};

export const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
  'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya',
];

export const FEATURES = {
  step_free_entry: 'Step-free entrance',
  ramp: 'Ramp',
  lift: 'Lift / elevator',
  accessible_toilet: 'Accessible toilet',
  oku_parking: 'OKU parking bay',
  wide_aisles: 'Wide aisles & doorways',
  tactile_paving: 'Tactile paving',
  braille_signage: 'Braille / tactile signage',
  hearing_loop: 'Hearing loop',
  trained_staff: 'Staff trained to assist',
  assistance_animals: 'Assistance animals welcome',
  quiet_space: 'Quiet / low-sensory space',
};

export const OFFER_KINDS = {
  discount: 'Discount',
  free: 'Free / waived',
  priority: 'Priority service',
  freebie: 'Freebie / add-on',
  other: 'Other perk',
};

export const BENEFIT_CATEGORIES = {
  financial: 'Financial assistance',
  tax: 'Tax relief',
  healthcare: 'Healthcare',
  transport: 'Transport',
  education: 'Education',
  employment: 'Employment',
  vehicle: 'Vehicles & parking',
  assistive: 'Assistive devices',
  other: 'Other',
};

// Rough bounding box around Malaysia; rejects obviously wrong coordinates.
export const MY_BOUNDS = { minLat: 0.8, maxLat: 7.5, minLng: 99.5, maxLng: 119.5 };

export const meta = () => ({
  categories: CATEGORIES,
  states: STATES,
  features: FEATURES,
  offerKinds: OFFER_KINDS,
  benefitCategories: BENEFIT_CATEGORIES,
  bounds: MY_BOUNDS,
});
