/**
 * Photo import (`docs/03-architecture/data-flow.md` §1).
 *
 * The invariant that shapes this whole file:
 *
 *   > the garment exists before analysis completes, so nothing is lost if
 *   > analysis fails.
 *
 * So this does the smallest amount of work that makes a photograph into a real,
 * visible garment — create the row, attach the original image, record
 * provenance, enqueue the pipeline — and returns. Everything that could be slow
 * or could fail happens in the worker, behind a tile the user can already see
 * (PERF-3: capture → visible in closet < 1 s).
 */
import { ApiError, ErrorCode } from '../../http/errors.js';
import type { UserScope } from '../../db/scope.js';
import { bucketOf, isSafeStorageKey, userOf, type StorageDriver } from '../../lib/storage.js';
import type { GarmentRepository } from '../closet/repository.js';
import type { ImportsRepository } from './repository.js';

/** Enqueue side of the worker's queue, narrowed to what this module needs. */
export type JobEnqueuer = {
  enqueue(job: {
    type: 'image.process';
    userId: string;
    idempotencyKey: string;
    payload: { garmentImageId: string; uploadKey: string };
  }): Promise<void>;
};

export type PhotoImportInput = {
  uploadKey: string;
  closetId: string;
  /** `camera` or `photo_library` — how the photograph reached us (taxonomy §14). */
  sourceType: 'camera' | 'photo_library';
  idempotencyKey: string;
};

export type PhotoImportResult = {
  garmentId: string;
  garmentImageId: string;
  jobId: string;
  /** Set when this photograph is already in the closet. */
  duplicateOfGarmentId: string | null;
};

/**
 * A photo import has no category yet — that is what analysis is for — but
 * `garments.category` is NOT NULL.
 *
 * `other` is a real member of the canonical taxonomy (`taxonomy.md` §1), not an
 * invented sentinel, so this places the garment honestly rather than widening
 * the taxonomy from application code (INV-1). Analysis replaces it.
 */
const UNANALYZED_CATEGORY = 'other';

export class ImportsService {
  constructor(
    private readonly imports: ImportsRepository,
    private readonly garments: GarmentRepository,
    private readonly storage: StorageDriver,
    private readonly queue: JobEnqueuer,
  ) {}

  async importPhoto(scope: UserScope, input: PhotoImportInput): Promise<PhotoImportResult> {
    await this.assertUsableUpload(scope, input.uploadKey);

    const garment = await this.garments.create(scope, {
      closetId: input.closetId,
      name: null,
      brandRaw: null,
      category: UNANALYZED_CATEGORY,
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
      purchaseDate: null,
      purchasePrice: null,
      currency: null,
      retailer: null,
      sku: null,
      barcode: null,
      productUrl: null,
      sourceType: input.sourceType,
      sourceReference: input.uploadKey,
      tagsAttached: null,
      notes: null,
      // Created already analyzing, so the closet can show the state rather than
      // a garment that looks finished and then silently changes.
      analysisState: 'analyzing',
    });

    // The original, before any processing. It is canonical until a cutout earns
    // the position, so the tile has an image from the first render — never a
    // blank frame waiting on the worker.
    const image = await this.imports.createImage(scope, {
      garmentId: garment.id,
      kind: 'original',
      storageKey: input.uploadKey,
      isCanonical: true,
      position: 0,
    });

    const job = await this.imports.createIngestionJob(scope, {
      jobType: 'image.process',
      entityType: 'garment_image',
      entityId: image.id,
    });

    await this.queue.enqueue({
      type: 'image.process',
      userId: scope.userId,
      // The client's key, so a retried request re-enqueues the same work
      // instead of processing the same photograph twice.
      idempotencyKey: input.idempotencyKey,
      payload: { garmentImageId: image.id, uploadKey: input.uploadKey },
    });

    return {
      garmentId: garment.id,
      garmentImageId: image.id,
      jobId: job.id,
      duplicateOfGarmentId: null,
    };
  }

  /**
   * The upload key must be this user's, well-formed, in the right bucket, and
   * actually present.
   *
   * Ownership is checked from the key's own prefix rather than trusted from the
   * request: a key naming another user's storage is the whole IDOR surface of
   * this endpoint (SEC-5).
   */
  private async assertUsableUpload(scope: UserScope, uploadKey: string): Promise<void> {
    const invalid = (message: string) =>
      new ApiError(400, ErrorCode.uploadKeyInvalid, { message });

    if (!isSafeStorageKey(uploadKey)) throw invalid('That upload key is not valid.');

    if (userOf(uploadKey) !== scope.userId) {
      // Deliberately the same error as a malformed key: a distinct message
      // would confirm that another user's object exists.
      throw invalid('That upload key is not valid.');
    }

    if (bucketOf(uploadKey) !== 'garments') {
      throw invalid('That upload is not a garment photo.');
    }

    if (!(await this.storage.exists(uploadKey))) {
      throw new ApiError(409, ErrorCode.uploadKeyInvalid, {
        message: 'That photo has not finished uploading.',
      });
    }
  }
}
