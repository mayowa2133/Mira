# Open Questions

Unresolved questions, with who is blocked and when an answer is needed. When one is
answered, move it to [decisions.md](decisions.md) and delete it here.

---

## Product

**Q-01. What is the minimum closet size at which the stylist is worth showing?**
Below some threshold, generated outfits are embarrassing rather than useful.
*Needed by:* Phase 7. *Leaning:* ~20 garments with at least one of top, bottom and
shoes; below that, Home shows import prompts instead of a look.

**Q-02. Should Mira ever suggest something to buy?**
The spec says shopping recommendations may become a future feature but must never
displace "style what you own". Where exactly is that line — is "you have no
black heels for this look" acceptable?
*Needed by:* Phase 7. *Leaning:* stating a gap is fine; linking to a product is
not, in V1.

**Q-03. How does Mira handle clothing that isn't the user's — a partner's, a
child's?**
*Needed by:* Phase 8 (email detection surfaces this immediately, via
"bought for someone else"). *Leaning:* out of scope beyond the `not_mine`
candidate status; multi-closet is a later feature.

**Q-04. Should outfits be plannable for a future date?**
"What am I wearing to the wedding on Saturday" is a natural extension of the
outfit builder and of wear history.
*Needed by:* Phase 9. *Leaning:* yes, as a lightweight date on a saved look.

**Q-05. How prominent should cost-per-wear be?**
It is powerful for the secondary persona and potentially unwelcome for the
primary one.
*Needed by:* Phase 9. *Leaning:* collapsed by default, opt-in.

## Design

**Q-06. Does the Looks masonry mix content types well in practice?**
Outfit collages, try-on results and user photos have very different shapes.
*Needed by:* Phase 6. *Resolve by:* building it with the `realistic` seed and
looking at it.

**Q-07. What does a garment tile look like while analyzing?**
A skeleton reads as loading; the real photo with a badge reads as done.
*Needed by:* Phase 2. *Leaning:* the user's own photo, dimmed, with a subtle
progress indicator — she should see her garment immediately.

**Q-08. Dark mode in V1?**
Tokens are authored for it, but no design pass has been done.
*Needed by:* before launch. *Leaning:* ship light-only, keep the tokens honest.

## Technical

**Q-09. Which embedding model, and one vector or two?**
Currently specified as separate image and text vectors.
*Needed by:* Phase 5. *Resolve by:* benchmarking on the 100-search evaluation set.

**Q-10. Can try-on be composed layer by layer with acceptable fidelity?**
Full-look generation in one pass may not be available from every provider.
*Needed by:* Phase 10. *Resolve by:* provider evaluation.

**Q-11. How aggressively should Mira re-analyze garments when models improve?**
Re-analysis costs money and could overwrite values the user has come to rely on.
*Needed by:* after Phase 3. *Leaning:* explicit, user-triggered per garment; never
automatic, never overwriting user-set values.

**Q-12. Where does outfit collage rendering happen — client or server?**
Server is consistent and cacheable; client is instant and free.
*Needed by:* Phase 6.

**Q-13. Do we need a background refresh for email scans, or is on-open enough?**
Background refresh gives the "Mira already knows" moment; on-open is simpler and
cheaper.
*Needed by:* Phase 8. *Leaning:* on-open plus a periodic server-side scan.

## Privacy and policy

**Q-14. What is the exact consent flow for contributing images to evaluation sets?**
`docs/07-security/privacy.md` allows it with explicit, revocable consent, but the
flow is unspecified.
*Needed by:* before any production image enters an evaluation set.

**Q-15. Should try-on generations expire automatically?**
They are images of the user's body, and keeping them forever by default may be
the wrong kindness.
*Needed by:* Phase 10. *Leaning:* keep until deleted, but make deletion
prominent, and offer an auto-delete preference.

**Q-16. What is Mira's stance if an AI provider changes its retention terms
mid-contract?**
*Needed by:* before Phase 3 ships to production. *Leaning:* provider becomes
ineligible, capability falls back, and users are told if their data was affected.
