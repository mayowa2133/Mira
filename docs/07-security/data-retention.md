# Data Retention

What Mira keeps, for how long, and exactly what happens when a user deletes
something.

**Rule:** store only what Mira needs (privacy principle 11), and honour deletion
completely (SEC-7).

---

## Retention schedule

| Data | Retained | Notes |
| ---- | -------- | ----- |
| Account record | Life of the account | |
| Garment records | Life of the account | Soft-deleted garments purge after 30 days |
| Garment images | Life of the garment + 30 days | Originals retained for re-analysis and try-on |
| Garment attributes and confidence | Life of the garment | Includes superseded values, for evaluation |
| Provenance (`garment_sources`) | Life of the garment | Append-only |
| Purchase candidates | Life of the email connection | Deleted on disconnect if the user asks |
| Purchase records | Life of the account | Survives garment deletion — spend history is separate |
| Receipt images | 90 days after parsing | The extracted data persists; the image does not need to |
| **Raw email bodies** | **Not retained** | Held in memory during extraction only |
| Email metadata (message id, date, sender domain) | Life of the connection | Needed for scan idempotency |
| Email OAuth tokens | Life of the connection | Encrypted; revoked and deleted on disconnect |
| **Body reference images** | **Until the user deletes them** | Never expire on their own |
| **Try-on generations** | **Until the user deletes them** | Cached by fingerprint |
| Wear events | Life of the account | |
| Search history | 180 days | Used for recents and the search-success metric |
| Recommendations | 180 days | Used for evaluation |
| Ingestion jobs | 30 days | Then only aggregate counts |
| Analytics events | Per the analytics provider's retention | Contains no user content |
| Server logs | 30 days | Redacted; no tokens, images, email bodies or body data |
| Backups | 35 days, rolling | See §Deletion and backups |

---

## Deletion semantics

### Soft vs hard

| Action | Type | Recoverable |
| ------ | ---- | ----------- |
| Remove a garment | Soft (30 days) | Yes, via `POST /garments/:id/restore` |
| Archive a garment | Status change | Yes — not a deletion at all |
| **Delete a body image** | **Hard, immediate** | No |
| **Delete a try-on** | **Hard, immediate** | No |
| Delete an outfit | Soft (30 days) | Yes |
| Disconnect email | Hard on the connection; candidates optional | Token gone immediately |
| Delete account | Hard | No |

Body images and try-ons are hard-deleted immediately and deliberately. A user
deleting a photograph of their own body must not be told it is in a recycle bin
for a month.

### Delete a body image

```text
1. Delete the storage object and every derivative
2. Delete the row
3. Invalidate every try-on whose fingerprint includes that image
4. Request provider-side deletion of any retained artefact, where supported
5. Confirm to the user
```

### Delete a try-on

```text
1. Delete the storage object
2. Delete the row (hard)
3. Purge any cached copy
```

### Disconnect email

```text
1. Revoke the token with the provider
2. Delete the encrypted tokens and the connection row
3. If the user chose deletion: delete purchase_candidates from that connection,
   and any cached retailer images
4. Garments already created from confirmed candidates REMAIN — the user owns
   those clothes; only the email link is severed
```

Point 4 is deliberate: disconnecting email must not silently empty the closet.
The disconnect confirmation says so explicitly.

### Delete account

```text
1. Confirmation stating exactly what is removed and that it is irreversible
2. Revoke all sessions immediately
3. Enqueue the deletion job
4. Hard delete, in order:
     try_on_generations + objects
     body_profile_images + objects
     body_profiles
     garment_images + objects
     garments, garment_attributes, garment_sources, garment_embeddings
     outfits, outfit_items, wear_events
     purchase_candidates, purchase_records, receipt_imports + objects
     email_connections (tokens revoked first)
     search_history, recommendations, style_preferences
     notifications, ingestion_jobs
     the user row
5. Delete the provider identity
6. Prefix-delete every storage bucket for that user_id
7. Confirm by email if an address is on file
```

Target: complete within 30 days; typically minutes.

## Deletion and backups

Backups roll off after 35 days. A deleted user's data may persist in a backup
until then. Mira does not restore individual records from backups, and a restore
after a deletion re-applies the deletion log. This is stated in the privacy
policy, because claiming instant backup erasure would be false.

## Reliability

Deletion jobs are idempotent and retried with backoff. A job that reaches its
final attempt **alerts** — "we failed to delete your photo" is not an acceptable
silent outcome. Failed deletions are tracked until resolved.

## Export

`You → Privacy & data → Export my data` produces a JSON archive of garments,
outfits, wear history, purchase records and preferences, plus the user's original
images. Delivered as a signed, expiring download.

## Changes

Changing anything in this document requires an entry in
`docs/09-decisions/decisions.md` and a corresponding update to the user-facing
privacy policy.
