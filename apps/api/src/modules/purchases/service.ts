/**
 * Purchase candidates (tasks 8.3, 8.5, 8.6; ADR 0003).
 *
 * The rule this service exists to hold: **only `confirmed_owned` creates a
 * garment** (OWN-1). It is enforced here, and again by a check constraint on
 * the table — neither is permitted to be the only one, for the same reason
 * SEC-5 requires two mechanisms.
 */
import { isPurchaseCandidateStatus, type PurchaseCandidateStatus } from '@mira/taxonomy';
import type { UserScope } from '../../db/scope.js';
import { ApiError, ErrorCode, notFound, validationFailed } from '../../http/errors.js';
import type { ClosetService } from '../closet/service.js';
import type { IdentityRepository } from '../identity/repository.js';
import { CREATES_GARMENT, REVIEWABLE, canTransition } from './rules.js';
import type { CandidateRow, PurchaseRepository } from './repository.js';

export type SerializedCandidate = ReturnType<typeof serialize>;

function serialize(row: CandidateRow) {
  const price =
    row.purchase_price === null || row.currency === null
      ? null
      : { amount: Number(row.purchase_price), currency: row.currency };

  return {
    id: row.id,
    source: { type: row.source_type, id: row.source_id },
    retailer: row.retailer,
    order_number: row.order_number,
    purchase_date: row.purchase_date ? row.purchase_date.toISOString().slice(0, 10) : null,
    price,
    // Both kept: `raw_item_name` is what the source literally said, so a bad
    // clean-up is recoverable and the review card can show the original.
    raw_item_name: row.raw_item_name,
    product_name: row.product_name,
    brand: row.brand,
    identifiers: { sku: row.sku, barcode: row.barcode, product_url: row.product_url },
    image_url: row.image_url,
    status: row.status,
    linked_garment_id: row.linked_garment_id,
    created_at: row.created_at.toISOString(),
  };
}

export class PurchaseService {
  constructor(
    private readonly repo: PurchaseRepository,
    private readonly closet: ClosetService,
    private readonly identity: IdentityRepository,
  ) {}

  async list(scope: UserScope, params: { status?: string[]; retailer?: string[]; limit: number }) {
    for (const status of params.status ?? []) {
      if (!isPurchaseCandidateStatus(status)) {
        throw new ApiError(422, ErrorCode.notInTaxonomy, {
          details: [{ field: 'status', issue: `"${status}" is not a candidate status` }],
        });
      }
    }

    // Default to what is actually awaiting a decision. A discovery screen that
    // opened on everything ever detected would bury the six things to look at
    // under six hundred that are done.
    const status = params.status?.length ? params.status : REVIEWABLE;
    const rows = await this.repo.list(scope, { ...params, status });

    return {
      data: rows.map(serialize),
      total: Number(rows[0]?.total_count ?? 0),
    };
  }

  async summary(scope: UserScope) {
    return { data: await this.repo.summary(scope) };
  }

  async get(scope: UserScope, id: string) {
    const row = await this.repo.findById(scope, id);
    if (!row) throw notFound(ErrorCode.candidateNotFound);
    return serialize(row);
  }

  /**
   * Change a candidate's status, creating a garment only for `confirmed_owned`.
   *
   * The garment is created BEFORE the status is written. If creation fails the
   * candidate stays reviewable and the user can try again; the other order
   * would mark it owned with nothing in the closet, which is the one
   * inconsistency this whole design exists to prevent.
   */
  async setStatus(scope: UserScope, id: string, next: string) {
    if (!isPurchaseCandidateStatus(next)) {
      throw new ApiError(422, ErrorCode.notInTaxonomy, {
        details: [{ field: 'status', issue: `"${next}" is not a candidate status` }],
      });
    }

    const row = await this.repo.findById(scope, id);
    if (!row) throw notFound(ErrorCode.candidateNotFound);

    const verdict = canTransition(row.status as PurchaseCandidateStatus, next);
    if (!verdict.allowed) {
      throw new ApiError(422, ErrorCode.invalidStatusTransition, {
        details: [{ field: 'status', issue: verdict.reason }],
      });
    }

    let garmentId: string | null = null;
    if (verdict.createsGarment) {
      garmentId = await this.createGarmentFrom(scope, row);
    }

    const updated = await this.repo.setStatus(scope, id, next, garmentId);
    if (!updated) throw notFound(ErrorCode.candidateNotFound);

    // The purchase happened whatever the answer was — a return is still a
    // purchase, and `purchase_records` is the fact that survives the garment.
    if (next === CREATES_GARMENT || next === 'returned') {
      await this.repo.recordPurchase(scope, { candidateId: id, garmentId, candidate: row });
    }

    return serialize(updated);
  }

  /**
   * Turn a candidate into a garment.
   *
   * Category is `other`: a purchase email says what was bought, not what
   * category Mira files it under, and `other` is a real taxonomy member rather
   * than an invented sentinel (D-019). Analysis replaces it.
   */
  private async createGarmentFrom(scope: UserScope, row: CandidateRow): Promise<string> {
    const closet =
      (await this.identity.findDefaultCloset(scope)) ??
      (await this.identity.createDefaultCloset(scope));

    const { garment } = await this.closet.createChecked(
      scope,
      closet.id,
      {
        name: row.product_name ?? row.raw_item_name,
        brandRaw: row.brand,
        category: 'other',
        subcategory: null,
        primaryColor: null,
        secondaryColors: [],
        pattern: null,
        materials: [],
        sizeRaw: null,
        sizeNormalized: null,
        sizeSystem: null,
        fit: null,
        season: [],
        occasion: [],
        styleTags: [],
        purchaseDate: row.purchase_date ? row.purchase_date.toISOString().slice(0, 10) : null,
        purchasePrice: row.purchase_price === null ? null : Number(row.purchase_price),
        currency: row.currency,
        retailer: row.retailer,
        sku: row.sku,
        barcode: row.barcode,
        productUrl: row.product_url,
        sourceType: row.source_type,
        // The candidate it came from, so provenance points back at the email.
        sourceReference: `${row.source_id}:${row.raw_item_name}`,
        tagsAttached: null,
        notes: null,
      },
      // No resolution, so duplicate detection runs on this path like every
      // other (CAP-5) and a real duplicate raises 409 `duplicate_unresolved`.
      //
      // That propagates to the caller ON PURPOSE. Auto-resolving it here would
      // mean Mira asserting "these are different" on the user's behalf, which
      // is a claim only they can make — and D-024 already establishes that the
      // client shows the sheet. The candidate stays reviewable meanwhile,
      // because the status is written only after the garment exists.
      null,
    );

    return garment.id;
  }
}

export { validationFailed };
