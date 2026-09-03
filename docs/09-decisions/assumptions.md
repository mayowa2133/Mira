# Assumptions

Things Mira's plan depends on that have not been proven. Each has a way to be
tested and a consequence if it is wrong.

Review this document at the end of each phase.

---

## Product

**A-01. Users will photograph garments in bulk if each one costs a few seconds.**
- *Test:* import efficiency (actions per garment) and session length during
  onboarding.
- *If wrong:* email and receipt import become the only viable paths, and Phase 4
  changes shape entirely.

**A-02. Email purchase detection covers a meaningful share of a real wardrobe.**
- *Test:* candidates found per connected account; user-reported coverage.
- *If wrong:* the highest-value import path is weaker than planned, and photo
  capture must carry the load.

**A-03. Users will confirm ownership candidate by candidate for ~100 items.**
- *Test:* completion rate on Purchase Review; drop-off position.
- *If wrong:* bulk actions ("everything from this retailer") and smarter defaults
  become necessary.

**A-04. Outfit suggestions from an owned closet are compelling enough to return
for.**
- *Test:* stylist acceptance rate; repeat usage of the Mira tab.
- *If wrong:* Mira is an organizer, not a stylist, and the product's centre of
  gravity moves.

**A-05. Users will add body photos.**
- *Test:* body profile completion rate among users who tap "Try it on".
- *If wrong:* try-on's reach is limited, and Phase 10's value drops sharply.

**A-06. Wardrobe insights bring users back between dressing occasions.**
- *Test:* opens attributable to rediscovery cards and notifications.
- *If wrong:* Mira is used only when getting dressed, and retention depends
  entirely on the stylist.

## Technical

**A-07. Vision models can classify garments accurately enough from a phone photo.**
- *Test:* the 200-image evaluation set. Target: category ≥ 0.95.
- *If wrong:* more user confirmation is required, which directly attacks the North
  Star.

**A-08. Segmentation succeeds on ≥ 90% of realistic photos.**
- *Test:* cutout acceptance rate.
- *If wrong:* closets look inconsistent, and try-on fidelity suffers.

**A-09. pgvector is sufficient for semantic search at V1 scale.**
- *Test:* search p95 with the 1,200-garment seed.
- *If wrong:* a dedicated vector store is needed — an additive change, not a
  rewrite.

**A-10. Try-on providers can hit garment fidelity ≥ 4.2.**
- *Test:* the 50-combination human-rated set.
- *If wrong:* try-on ships later, or narrows to single garments where fidelity is
  achievable.

**A-11. AI cost per user stays within a sustainable envelope.**
- *Test:* cost per capability per active user, monthly.
- *If wrong:* stricter caching, cheaper models, and try-on becomes a paid
  feature.

**A-12. Email providers will grant a scope narrow enough to be defensible.**
- *Test:* scope review during Phase 8 implementation.
- *If wrong:* the privacy explainer must be more explicit, or the feature is
  reconsidered.

## Users

**A-13. The primary persona is a woman with a large wardrobe who likes fashion.**
- *Test:* early user research and retention by segment.
- *If wrong:* the visual direction and default proportions change, though the
  architecture does not.

**A-14. Users tolerate asynchronous analysis if the garment appears immediately.**
- *Test:* abandonment rate between capture and confirmation.
- *If wrong:* synchronous analysis is needed for the first few garments, which
  costs latency budget.

**A-15. Users understand that try-on is visualization, not fit.**
- *Test:* support contacts and user feedback wording.
- *If wrong:* the copy becomes more explicit, and possibly a one-time
  acknowledgement is added.

## Business

**A-16. Retailer integrations are not required for a compelling V1.**
- *Test:* whether email + receipts + photos reach acceptable closet coverage.
- *If wrong:* integrations move earlier, with the partnership work that implies.

**A-17. There is no need for a web experience in V1.**
- *Test:* user requests; whether bulk import would genuinely be easier on a
  desktop.
- *If wrong:* a narrow web import surface, not a full web app.
