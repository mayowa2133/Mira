/**
 * Compile-time tests.
 *
 * These assert that application code CANNOT widen the taxonomy (INV-1).
 * Every `@ts-expect-error` below must produce an error; if the taxonomy is
 * accidentally widened to `string`, the expected error disappears and
 * `tsc` fails the build. This file is typechecked, never executed.
 *
 * Exit criterion for task 0.6 in tasks/current.md.
 */
import type { Category, Color, GarmentStatus, OutfitSlot, Subcategory } from './generated.js';

// --- valid values compile -------------------------------------------------
const dresses: Category = 'dresses';
const midi: Subcategory = 'midi_dress';
const black: Color = 'black';
const active: GarmentStatus = 'active';
const shoesSlot: OutfitSlot = 'shoes';

// --- invalid values must NOT compile --------------------------------------
// @ts-expect-error 'outfits' is not a category in docs/04-data/taxonomy.md
const notACategory: Category = 'outfits';

// @ts-expect-error 'jumpsuits' is not a subcategory (the value is 'jumpsuit', under sets)
const notASubcategory: Subcategory = 'jumpsuits';

// @ts-expect-error 'chartreuse' is not in the canonical colour list
const notAColor: Color = 'chartreuse';

// @ts-expect-error 'in_the_wash' is not a garment status; the value is 'laundry'
const notAStatus: GarmentStatus = 'in_the_wash';

// @ts-expect-error 'jewellery' is not an outfit slot
const notASlot: OutfitSlot = 'jewellery';

// @ts-expect-error a bare string can never widen the taxonomy
const notWidenable: Category = 'anything' as string;

export const __typeTests = {
  dresses,
  midi,
  black,
  active,
  shoesSlot,
  notACategory,
  notASubcategory,
  notAColor,
  notAStatus,
  notASlot,
  notWidenable,
};
