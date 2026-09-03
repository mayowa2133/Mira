# Terminology

Use these words consistently in code, copy, specs and analytics. When the product
and the database disagree on a word, the database follows this file.

| Term                     | Meaning                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Garment**              | A single item the user owns. Includes shoes, bags and accessories, not just clothing. The canonical entity.  |
| **Item**                 | User-facing synonym for garment. Prefer "piece" or "item" in UI copy; use "garment" in code.                 |
| **Piece**                | UI copy synonym for garment. "327 pieces."                                                                    |
| **Closet**               | The full set of a user's garments. One closet per user in V1.                                                |
| **Look**                 | User-facing word for an outfit. "Looks" is the tab name.                                                     |
| **Outfit**               | Code/database word for a saved combination of garments. Same thing as a Look.                                |
| **Outfit slot**          | A role within an outfit: top, bottom, dress, layer, shoes, bag, accessory.                                   |
| **Capture / ingestion**  | Getting a garment into Mira by any method.                                                                    |
| **Source**               | How a garment entered Mira (`camera`, `receipt`, `email`, …). Provenance is never discarded.                 |
| **Purchase candidate**   | A detected purchase that may or may not correspond to an owned garment. **Not** a garment.                   |
| **Purchase record**      | A confirmed purchase fact (retailer, date, price), which may be linked to a garment.                          |
| **Confirmed owned**      | The user has explicitly said they still own the item. Only this state creates a garment from a candidate.    |
| **Status**               | A garment's current availability: `active`, `laundry`, `archived`, … See `docs/04-data/taxonomy.md`.         |
| **Available**            | Status is `active`. Only available garments participate in outfit generation by default.                     |
| **Wear event**           | A record that a garment or outfit was worn on a date.                                                        |
| **Body profile**         | The user's private body reference images and optional measurements, used only for try-on.                    |
| **Try-on generation**    | One generated image of an outfit on the user's body reference.                                               |
| **Garment fidelity**     | How faithfully a try-on reproduces the *actual* selected garment. The top try-on quality metric.             |
| **Identity consistency** | How recognizably the try-on preserves the user's own appearance and body.                                    |
| **Canonical image**      | The primary display image for a garment — usually the AI-cleaned cutout.                                     |
| **Cutout**               | A garment image with its background removed.                                                                 |
| **Confidence**           | A 0–1 score attached to a machine-generated field. Never fabricate high certainty.                           |
| **Taxonomy**             | The centralized set of valid categories, subcategories, colours, occasions, seasons. AI cannot extend it.    |
| **Mira**                 | Both the product and the AI stylist surface (the centre tab). Capitalized, never "MIRA AI" or "Mira Bot".    |

## Words to avoid in user-facing copy

| Avoid                        | Use instead                          |
| ---------------------------- | ------------------------------------ |
| Inventory, catalogue, records | Closet, pieces, your things          |
| Item count, utilization rate  | "327 pieces", "17 pieces deserve another chance" |
| SKU, metadata, attributes     | Details                              |
| AI-generated, powered by AI   | "Mira found", or say nothing         |
| Upload, sync, ingest          | Add, scan, find                      |
| Entity, object, record        | Piece, look                          |
