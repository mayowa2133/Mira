/* eslint-disable */
// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
//
// Source:    docs/04-data/taxonomy.md
// Regenerate: npm run generate:taxonomy
//
// docs/04-data/taxonomy.md is the single source of truth for every enumerated
// value in Mira. Application code reads these types; it never widens them
// (INV-1). AI output is clamped to these values before persistence (AI-3).
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "sets",
  "outerwear",
  "shoes",
  "bags",
  "accessories",
  "activewear",
  "swimwear",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (v: unknown): v is Category =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);

export const SUBCATEGORIES = [
  "t_shirt",
  "tank",
  "blouse",
  "shirt",
  "sweater",
  "cardigan",
  "hoodie",
  "bodysuit",
  "crop_top",
  "other",
  "jeans",
  "trousers",
  "leggings",
  "shorts",
  "skirt",
  "sweatpants",
  "mini_dress",
  "midi_dress",
  "maxi_dress",
  "bodycon_dress",
  "cocktail_dress",
  "slip_dress",
  "formal_dress",
  "co_ord",
  "suit",
  "jumpsuit",
  "romper",
  "jacket",
  "denim_jacket",
  "leather_jacket",
  "blazer",
  "coat",
  "trench",
  "puffer",
  "vest",
  "heels",
  "flats",
  "sneakers",
  "boots",
  "ankle_boots",
  "sandals",
  "loafers",
  "mules",
  "shoulder_bag",
  "tote",
  "crossbody",
  "clutch",
  "mini_bag",
  "backpack",
  "jewelry",
  "belt",
  "hat",
  "scarf",
  "sunglasses",
  "hair_accessory",
  "gloves",
  "watch",
  "sports_bra",
  "active_top",
  "active_leggings",
  "active_shorts",
  "active_set",
  "bikini",
  "one_piece",
  "cover_up",
] as const;
export type Subcategory = (typeof SUBCATEGORIES)[number];
export const isSubcategory = (v: unknown): v is Subcategory =>
  typeof v === 'string' && (SUBCATEGORIES as readonly string[]).includes(v);

export const COLORS = [
  "black",
  "red",
  "white",
  "burgundy",
  "ivory",
  "pink",
  "cream",
  "blush",
  "beige",
  "hot_pink",
  "tan",
  "orange",
  "brown",
  "peach",
  "chocolate",
  "yellow",
  "grey",
  "mustard",
  "charcoal",
  "green",
  "silver",
  "olive",
  "gold",
  "sage",
  "navy",
  "emerald",
  "blue",
  "purple",
  "light_blue",
  "lilac",
  "denim",
  "multicolor",
] as const;
export type Color = (typeof COLORS)[number];
export const isColor = (v: unknown): v is Color =>
  typeof v === 'string' && (COLORS as readonly string[]).includes(v);

export const PATTERNS = [
  "solid",
  "striped",
  "floral",
  "animal_print",
  "plaid",
  "checked",
  "polka_dot",
  "geometric",
  "abstract",
  "tie_dye",
  "camouflage",
  "logo",
  "lace",
  "sequin",
  "metallic",
  "embroidered",
  "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];
export const isPattern = (v: unknown): v is Pattern =>
  typeof v === 'string' && (PATTERNS as readonly string[]).includes(v);

export const MATERIALS = [
  "cotton",
  "linen",
  "silk",
  "satin",
  "wool",
  "cashmere",
  "denim",
  "leather",
  "faux_leather",
  "suede",
  "polyester",
  "nylon",
  "viscose",
  "rayon",
  "modal",
  "spandex",
  "knit",
  "mesh",
  "velvet",
  "corduroy",
  "fleece",
  "down",
  "other",
] as const;
export type Material = (typeof MATERIALS)[number];
export const isMaterial = (v: unknown): v is Material =>
  typeof v === 'string' && (MATERIALS as readonly string[]).includes(v);

export const FITS = [
  "slim",
  "fitted",
  "bodycon",
  "regular",
  "relaxed",
  "oversized",
  "loose",
  "straight",
  "skinny",
  "wide_leg",
  "flare",
  "bootcut",
  "tapered",
  "cropped",
  "a_line",
] as const;
export type Fit = (typeof FITS)[number];
export const isFit = (v: unknown): v is Fit =>
  typeof v === 'string' && (FITS as readonly string[]).includes(v);

export const SLEEVE_LENGTHS = [
  "sleeveless",
  "cap",
  "short",
  "three_quarter",
  "long",
  "extra_long",
] as const;
export type SleeveLength = (typeof SLEEVE_LENGTHS)[number];
export const isSleeveLength = (v: unknown): v is SleeveLength =>
  typeof v === 'string' && (SLEEVE_LENGTHS as readonly string[]).includes(v);

export const SLEEVE_TYPES = [
  "none",
  "set_in",
  "raglan",
  "puff",
  "bishop",
  "bell",
  "dolman",
  "off_shoulder",
  "one_shoulder",
  "strapless",
  "spaghetti_strap",
  "halter",
] as const;
export type SleeveType = (typeof SLEEVE_TYPES)[number];
export const isSleeveType = (v: unknown): v is SleeveType =>
  typeof v === 'string' && (SLEEVE_TYPES as readonly string[]).includes(v);

export const NECKLINES = [
  "crew",
  "v_neck",
  "scoop",
  "square",
  "sweetheart",
  "halter",
  "off_shoulder",
  "one_shoulder",
  "turtleneck",
  "mock_neck",
  "cowl",
  "collared",
  "boat",
  "plunge",
  "strapless",
  "other",
] as const;
export type Neckline = (typeof NECKLINES)[number];
export const isNeckline = (v: unknown): v is Neckline =>
  typeof v === 'string' && (NECKLINES as readonly string[]).includes(v);

export const LENGTHS = [
  "cropped",
  "hip",
  "tunic",
  "mini",
  "midi",
  "maxi",
  "ankle",
  "floor",
] as const;
export type Length = (typeof LENGTHS)[number];
export const isLength = (v: unknown): v is Length =>
  typeof v === 'string' && (LENGTHS as readonly string[]).includes(v);

export const SEASONS = [
  "spring",
  "summer",
  "fall",
  "winter",
] as const;
export type Season = (typeof SEASONS)[number];
export const isSeason = (v: unknown): v is Season =>
  typeof v === 'string' && (SEASONS as readonly string[]).includes(v);

export const OCCASIONS = [
  "casual",
  "work",
  "school",
  "brunch",
  "dinner",
  "date",
  "going_out",
  "party",
  "club",
  "wedding",
  "formal",
  "vacation",
  "beach",
  "gym",
  "lounge",
  "travel",
] as const;
export type Occasion = (typeof OCCASIONS)[number];
export const isOccasion = (v: unknown): v is Occasion =>
  typeof v === 'string' && (OCCASIONS as readonly string[]).includes(v);

export const STYLE_TAGS = [
  "minimal",
  "classic",
  "edgy",
  "feminine",
  "romantic",
  "sporty",
  "streetwear",
  "preppy",
  "bohemian",
  "glam",
  "y2k",
  "coquette",
  "western",
  "grunge",
  "business",
] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];
export const isStyleTag = (v: unknown): v is StyleTag =>
  typeof v === 'string' && (STYLE_TAGS as readonly string[]).includes(v);

export const GARMENT_STATUSES = [
  "active",
  "laundry",
  "unavailable",
  "lent_out",
  "returned",
  "sold",
  "donated",
  "lost",
  "archived",
] as const;
export type GarmentStatus = (typeof GARMENT_STATUSES)[number];
export const isGarmentStatus = (v: unknown): v is GarmentStatus =>
  typeof v === 'string' && (GARMENT_STATUSES as readonly string[]).includes(v);

export const SOURCE_TYPES = [
  "manual",
  "camera",
  "photo_library",
  "tag_scan",
  "barcode",
  "receipt",
  "email",
  "retailer_integration",
  "product_url",
  "order_screenshot",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const isSourceType = (v: unknown): v is SourceType =>
  typeof v === 'string' && (SOURCE_TYPES as readonly string[]).includes(v);

export const PURCHASE_CANDIDATE_STATUSES = [
  "detected",
  "processing",
  "needs_review",
  "confirmed_owned",
  "returned",
  "not_mine",
  "removed",
  "uncertain",
  "ignored",
] as const;
export type PurchaseCandidateStatus = (typeof PURCHASE_CANDIDATE_STATUSES)[number];
export const isPurchaseCandidateStatus = (v: unknown): v is PurchaseCandidateStatus =>
  typeof v === 'string' && (PURCHASE_CANDIDATE_STATUSES as readonly string[]).includes(v);

export const IMAGE_KINDS = [
  "canonical",
  "original",
  "cleaned",
  "front",
  "back",
  "side",
  "detail",
  "retailer",
] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export const isImageKind = (v: unknown): v is ImageKind =>
  typeof v === 'string' && (IMAGE_KINDS as readonly string[]).includes(v);

export const OUTFIT_SLOTS = [
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "bag",
  "accessory",
] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];
export const isOutfitSlot = (v: unknown): v is OutfitSlot =>
  typeof v === 'string' && (OUTFIT_SLOTS as readonly string[]).includes(v);

export const SIZE_SYSTEMS = [
  "alpha",
  "numeric_us",
  "numeric_eu",
  "waist",
  "shoe_us",
  "shoe_eu",
  "one_size",
] as const;
export type SizeSystem = (typeof SIZE_SYSTEMS)[number];
export const isSizeSystem = (v: unknown): v is SizeSystem =>
  typeof v === 'string' && (SIZE_SYSTEMS as readonly string[]).includes(v);

/** Subcategories that belong to each category. A subcategory must belong to its
 *  category — `dresses/heels` is invalid (taxonomy §1). */
export const CATEGORY_SUBCATEGORIES: Readonly<Record<Category, readonly Subcategory[]>> = {
  tops: ["t_shirt", "tank", "blouse", "shirt", "sweater", "cardigan", "hoodie", "bodysuit", "crop_top", "other"],
  bottoms: ["jeans", "trousers", "leggings", "shorts", "skirt", "sweatpants", "other"],
  dresses: ["mini_dress", "midi_dress", "maxi_dress", "bodycon_dress", "cocktail_dress", "slip_dress", "formal_dress", "other"],
  sets: ["co_ord", "suit", "jumpsuit", "romper", "other"],
  outerwear: ["jacket", "denim_jacket", "leather_jacket", "blazer", "coat", "trench", "puffer", "vest", "other"],
  shoes: ["heels", "flats", "sneakers", "boots", "ankle_boots", "sandals", "loafers", "mules", "other"],
  bags: ["shoulder_bag", "tote", "crossbody", "clutch", "mini_bag", "backpack", "other"],
  accessories: ["jewelry", "belt", "hat", "scarf", "sunglasses", "hair_accessory", "gloves", "watch", "other"],
  activewear: ["sports_bra", "active_top", "active_leggings", "active_shorts", "active_set", "other"],
  swimwear: ["bikini", "one_piece", "cover_up", "other"],
  other: ["other"],
} as const;

export const isSubcategoryOf = (category: Category, subcategory: string): boolean =>
  (CATEGORY_SUBCATEGORIES[category] as readonly string[]).includes(subcategory);

/** Swatch values for the colour filter UI. These are UI swatches, not the
 *  garment's real colour. `multicolor` has no single swatch. */
export const COLOR_SWATCHES: Readonly<Record<Color, string | null>> = {
  black: "#000000",
  red: "#C0392B",
  white: "#FFFFFF",
  burgundy: "#6E1F2B",
  ivory: "#F6F1E7",
  pink: "#E8A0B4",
  cream: "#EFE6D6",
  blush: "#F0D3D1",
  beige: "#D8C7AE",
  hot_pink: "#D6237D",
  tan: "#C09A6B",
  orange: "#D97136",
  brown: "#7A5334",
  peach: "#F2C0A0",
  chocolate: "#4A3227",
  yellow: "#E9C349",
  grey: "#9A9691",
  mustard: "#C39A2E",
  charcoal: "#3B3A38",
  green: "#3F7A52",
  silver: "#C4C6C8",
  olive: "#6B6A3A",
  gold: "#C0A062",
  sage: "#A3B29A",
  navy: "#1E2A45",
  emerald: "#1F6B54",
  blue: "#3A5DA8",
  purple: "#6B4A8C",
  light_blue: "#A9C4E0",
  lilac: "#C3AED6",
  denim: "#4A6484",
  multicolor: null,
} as const;

/** Only these statuses participate in generated outfits (INV-2, D-012). */
export const OUTFIT_ELIGIBLE_STATUSES = [
  "active",
] as const;

export type OutfitEligibleStatus = (typeof OUTFIT_ELIGIBLE_STATUSES)[number];

export const isOutfitEligible = (status: GarmentStatus): boolean =>
  (OUTFIT_ELIGIBLE_STATUSES as readonly string[]).includes(status);

/** The only candidate status that creates a garment (OWN-1, ADR 0003). */
export const GARMENT_CREATING_CANDIDATE_STATUSES = [
  "confirmed_owned",
] as const;

export const createsGarment = (status: PurchaseCandidateStatus): boolean =>
  (GARMENT_CREATING_CANDIDATE_STATUSES as readonly string[]).includes(status);

/** Confidence bands (taxonomy §16). Bands, not raw numbers, reach the UI (D-011). */
export const CONFIDENCE = {
  high: 0.85,
  medium: 0.6,
  low: 0.35,
  /** Opt-in automatic purchase import also requires a matching identifier. */
  autoAccept: 0.92,
} as const;

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'very_low';

export const confidenceBand = (value: number): ConfidenceBand => {
  if (value >= CONFIDENCE.high) return 'high';
  if (value >= CONFIDENCE.medium) return 'medium';
  if (value >= CONFIDENCE.low) return 'low';
  return 'very_low';
};
