# Data Models

Application-level TypeScript shapes. These are the contract between the API, the
mobile client and the AI layer. Generated types live in `packages/types`; this
document explains their intent.

Database columns are in [database-schema.md](database-schema.md); enumerated
values are in [taxonomy.md](taxonomy.md).

---

## Garment

```ts
type Garment = {
  id: string;
  closetId: string;

  name: string | null;
  brand: Brand | null;
  brandRaw: string | null;

  category: Category;              // taxonomy §1
  subcategory: Subcategory | null;

  primaryColor: Color | null;
  secondaryColors: Color[];
  pattern: Pattern | null;
  materials: Material[];

  size: {
    raw: string | null;
    normalized: string | null;
    system: SizeSystem | null;
  };
  fit: Fit | null;

  season: Season[];
  occasion: Occasion[];
  styleTags: StyleTag[];

  purchase: {
    date: string | null;           // ISO date
    price: Money | null;
    retailer: string | null;
  };

  identifiers: {
    sku: string | null;
    barcode: string | null;
    productUrl: string | null;
  };

  source: {
    type: SourceType;              // taxonomy §11 — immutable
    reference: string | null;
  };

  status: GarmentStatus;           // taxonomy §10
  favorite: boolean;
  tagsAttached: boolean | null;
  notes: string | null;

  wear: {
    count: number;
    lastWornAt: string | null;
    costPerWear: Money | null;     // derived; null without price or wears
  };

  images: GarmentImage[];
  canonicalImage: GarmentImage | null;

  analysisState: 'pending' | 'analyzing' | 'complete' | 'failed' | 'skipped';
  confidence: Partial<Record<GarmentField, number>>;   // [0,1] per field

  createdAt: string;
  updatedAt: string;
};
```

**Notes**

- `source.type` is immutable after creation (CAP-3). The API rejects attempts to
  change it.
- `confidence` is present on every field the model produced. A field with a
  user-supplied value has no confidence entry — user values are facts.
- `costPerWear` is computed server-side so the client never divides by zero.

## GarmentImage

```ts
type GarmentImage = {
  id: string;
  kind: ImageKind;                 // taxonomy §13
  url: string;                     // signed, expiring
  urlExpiresAt: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  isCanonical: boolean;
  position: number;
};
```

Clients must handle `urlExpiresAt` and refetch rather than caching a URL
indefinitely.

## Money

```ts
type Money = { amount: number; currency: string };   // amount in major units, 2dp
```

## Brand

```ts
type Brand = { id: string; name: string; logoUrl: string | null };
```

---

## GarmentUnderstanding

What the vision capability returns. Validated before it touches the database
(AI-2). Full contract and prompt: `docs/06-ai/garment-understanding.md`.

```ts
type GarmentUnderstanding = {
  category: Category;
  subcategory: Subcategory | null;
  brand: string | null;
  productName: string | null;
  colors: Color[];                 // first is primary
  pattern: Pattern | null;
  materials: Material[];
  fit: Fit | null;
  sleeveLength: SleeveLength | null;
  sleeveType: SleeveType | null;
  neckline: Neckline | null;
  length: Length | null;
  season: Season[];
  occasion: Occasion[];
  style: StyleTag[];
  size: string | null;
  confidence: Partial<Record<GarmentField, number>>;
};
```

Every value must exist in the taxonomy. Unknown values are dropped by the clamp
step, not coerced to a neighbour.

---

## PurchaseCandidate

```ts
type PurchaseCandidate = {
  id: string;
  source: { type: 'email' | 'receipt' | 'retailer_integration' | 'order_screenshot'; id: string };
  retailer: string | null;
  orderNumber: string | null;
  purchaseDate: string | null;
  price: Money | null;
  rawItemName: string;
  productName: string | null;
  brand: string | null;
  identifiers: { sku: string | null; barcode: string | null; productUrl: string | null };
  imageUrl: string | null;
  matchConfidence: number | null;
  status: PurchaseCandidateStatus;  // taxonomy §12
  linkedGarmentId: string | null;
  createdAt: string;
};
```

A candidate is **not** a garment and never appears in closet responses.

---

## Outfit

```ts
type Outfit = {
  id: string;
  name: string | null;
  occasion: Occasion | null;
  season: Season[];
  origin: 'user' | 'mira';
  items: OutfitItem[];
  coverImageUrl: string | null;
  favorite: boolean;
  wear: { count: number; lastWornAt: string | null };
  createdAt: string;
  updatedAt: string;
};

type OutfitItem = {
  slot: OutfitSlot;                // taxonomy §14
  garment: Garment;                // hydrated; the client needs the image
  position: number;
};
```

## OutfitProposal

What the stylist returns before the user saves it.

```ts
type OutfitProposal = {
  title: string;                   // "Dinner downtown"
  rationale: string | null;        // one short line, shown sparingly
  items: { slot: OutfitSlot; garmentId: string }[];
  missingSlots: OutfitSlot[];      // honest about what the closet couldn't fill
};
```

Every `garmentId` is validated against the server-built candidate set before the
proposal is returned (AI-6).

---

## BodyProfile

```ts
type BodyProfile = {
  id: string;
  heightCm: number | null;
  usualSizes: Record<string, string> | null;
  fitPreferences: Record<string, string> | null;
  images: { id: string; kind: 'front' | 'side' | 'back' | 'reference'; url: string; urlExpiresAt: string }[];
  isActive: boolean;
  createdAt: string;
};
```

Never included in any response that is not explicitly the body-profile endpoint,
and never logged.

## TryOnGeneration

```ts
type TryOnGeneration = {
  id: string;
  outfitId: string | null;
  bodyProfileId: string;
  status: 'queued' | 'generating' | 'complete' | 'failed';
  imageUrl: string | null;         // signed, expiring
  urlExpiresAt: string | null;
  garments: { id: string; name: string | null; brand: string | null }[];
  favorite: boolean;
  rating: number | null;
  errorCode: string | null;
  createdAt: string;
};
```

---

## SearchResult

```ts
type SearchResult = {
  interpretation: {
    filters: GarmentFilters;       // what Mira understood — shown as chips
    semanticTerms: string[];
    sort: SortKey | null;
  };
  garments: Garment[];
  nextCursor: string | null;
  total: number | null;
};
```

Returning `interpretation` is required, not optional: it is what makes a wrong
interpretation visible and correctable.

## GarmentFilters

```ts
type GarmentFilters = {
  category?: Category[];
  subcategory?: Subcategory[];
  brandId?: string[];
  color?: Color[];
  size?: string[];
  season?: Season[];
  occasion?: Occasion[];
  material?: Material[];
  styleTag?: StyleTag[];
  retailer?: string[];
  status?: GarmentStatus[];
  favorite?: boolean;
  tagsAttached?: boolean;
  neverWorn?: boolean;
  notWornSinceDays?: number;
  purchasedAfter?: string;
  purchasedBefore?: string;
  priceMin?: number;
  priceMax?: number;
};
```

All filters combine with AND semantics (INV-3). Array values combine with OR
within the field.

---

## DuplicateCandidate

```ts
type DuplicateCandidate = {
  existingGarment: Garment;
  score: number;                   // [0,1]
  signals: ('sku' | 'barcode' | 'product_url' | 'order' | 'visual' | 'name' | 'date')[];
};
```

Showing which signals fired is what lets the user make a good decision in the
duplicate sheet.

---

## Insight

```ts
type Insight =
  | { kind: 'forgotten'; garments: Garment[]; monthsSinceWorn: number }
  | { kind: 'never_worn'; garments: Garment[] }
  | { kind: 'tags_attached'; garments: Garment[] }
  | { kind: 'most_loved'; garment: Garment; wearCount: number }
  | { kind: 'similar_owned'; pairs: { a: Garment; b: Garment }[] }
  | { kind: 'cost_per_wear'; garment: Garment; costPerWear: Money }
  | { kind: 'closet_value'; total: Money; unwornValue: Money };
```

The client renders each kind as fashion content, never as a statistic
(`docs/02-design/ux-principles.md` §6).
