-- 0010 — Vector indexes (task 5.1)
--
-- docs/04-data/database-schema.md §garment_embeddings.
--
-- HNSW rather than IVFFlat: IVFFlat needs to be built against representative
-- data and rebuilt as the table grows, and a closet is a table that grows one
-- garment at a time from empty. HNSW is incremental.
--
-- Cosine, because the embedding providers Phase 5 will use return normalized
-- vectors and cosine is what their own similarity is defined in. Using L2 on
-- normalized vectors would rank identically and read as if it were a choice.
--
-- These indexes are EMPTY until embedding.generate exists (5.2). Created now
-- because the table is here and an index added later is a lock on a table that
-- by then has something in it.

create index if not exists garment_embeddings_image_hnsw
  on garment_embeddings using hnsw (image_vec vector_cosine_ops);

create index if not exists garment_embeddings_text_hnsw
  on garment_embeddings using hnsw (text_vec vector_cosine_ops);
