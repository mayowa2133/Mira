/**
 * Mira design tokens.
 *
 * The SINGLE source of colour, type, spacing, radius, shadow and motion values.
 * Components read these; feature code never contains a literal hex, spacing,
 * radius or duration value (`docs/02-design/design-system.md` §10). That rule is
 * what keeps a dark-mode swap a one-file change, and it is enforced by ESLint.
 *
 * Token names match `docs/02-design/design-system.md` exactly. Adding a token
 * requires a line in that document in the same change.
 */

/**
 * Colour (`docs/02-design/design-system.md` §2).
 *
 * The app is warm ivory, not white. Text is near-black, not black. The dusty
 * rose accent is PUNCTUATION, not paint: selection, favourites and the Mira tab
 * — never every button, and never text on a light background (contrast 2.8:1).
 */
export const color = {
  bg: '#FAF9F7',
  surface: '#FFFFFF',
  surfaceSunken: '#F5F3F0',

  text: '#171717',
  textSecondary: '#76726E',
  /** Decorative or large text only — 2.5:1 on bg (docs/02-design/accessibility.md §1). */
  textTertiary: '#A8A29C',

  /** Fills and icons only. NEVER a text colour on a light background. */
  accent: '#C98F8A',
  accentSoft: '#F3E7E4',
  accentPressed: '#B87C77',

  success: '#7D8F7B',
  successSoft: '#EAEFE8',
  warning: '#C7994F',
  warningSoft: '#F7EFE0',
  danger: '#B4544B',
  dangerSoft: '#F6E7E5',

  divider: '#EDEAE6',
  border: '#DEDAD5',

  overlay: 'rgba(23,23,23,0.45)',
  /** Floating panels over imagery. Always paired with a backdrop blur + scrim. */
  glass: 'rgba(255,255,255,0.72)',

  inverseBg: '#171717',
  inverseText: '#FFFFFF',
} as const;

/**
 * Dark mode token overrides.
 *
 * V1 ships light only (Q-08). The set exists so dark mode stays a token swap
 * rather than a rewrite — which is only true while no component hard-codes a
 * colour.
 */
export const colorDark = {
  ...color,
  bg: '#141312',
  surface: '#1E1C1A',
  surfaceSunken: '#232120',
  text: '#F5F3F0',
  textSecondary: '#A29D97',
  textTertiary: '#726D68',
  divider: '#2B2825',
  border: '#3A3633',
  inverseBg: '#F5F3F0',
  inverseText: '#171717',
} as const;

export type ColorToken = keyof typeof color;

/** Typography (`docs/02-design/design-system.md` §3). All sizes scale with Dynamic Type. */
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: -0.4 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.3 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.2 },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: 0 },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6 },
  wordmark: { fontSize: 20, lineHeight: 24, fontWeight: '600', letterSpacing: 3 },
  /** Brand name above the garment name, uppercase. */
  brand: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.8 },
} as const;

export type TypeToken = keyof typeof type;

/** Spacing (`docs/02-design/design-system.md` §4). 4pt base scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 56,
  giant: 72,

  /** Horizontal screen padding. */
  screenX: 20,
  /** Gap between garment tiles. */
  gridGap: 12,
  /** Vertical gap between home sections. */
  sectionY: 32,
  cardPad: 16,
  /** Minimum touch target (A11Y-3, docs/02-design/accessibility.md §3). */
  tapMin: 44,
} as const;

export type SpaceToken = keyof typeof space;

/** Radii (`docs/02-design/design-system.md` §5). */
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 22,
  full: 999,
} as const;

/**
 * Shadows are EXTREMELY subtle — they lift a surface off ivory, never decorate.
 * Prefer a hairline or a background shift over a shadow.
 */
export const shadow = {
  card: { offsetY: 1, blur: 2, color: 'rgba(23,23,23,0.04)' },
  raised: { offsetY: 4, blur: 16, color: 'rgba(23,23,23,0.06)' },
  float: { offsetY: 8, blur: 32, color: 'rgba(23,23,23,0.10)' },
} as const;

/** Motion (`docs/02-design/design-system.md` §7). */
export const motion = {
  fast: 150,
  base: 240,
  sheet: 320,
  /** Shared element into garment detail. */
  hero: 420,
} as const;

/**
 * Layout constants that carry product decisions.
 *
 * The closet is TWO columns, never three: image size beats density (D-009).
 */
export const layout = {
  closetColumns: 2,
  /** Garment tiles are square to slightly portrait. */
  garmentAspectRatio: 4 / 5,
  lookAspectRatio: 3 / 4,
  /** Maximum text lines on a garment tile. */
  garmentTileMaxTextLines: 3,
} as const;

export const tokens = {
  color,
  colorDark,
  type,
  space,
  radius,
  shadow,
  motion,
  layout,
} as const;
