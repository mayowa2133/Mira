import XCTest

/// Automated accessibility checks.
///
/// `docs/02-design/accessibility.md` §10 lists a VoiceOver pass as a manual
/// ritual per release. Most of what that pass looks for — missing labels, hit
/// regions under 44pt, clipped text at large Dynamic Type, low contrast — is
/// exactly what `performAccessibilityAudit()` checks, so it can run in CI on
/// every change instead of once per release by whoever remembers.
///
/// It does not replace a human listening to VoiceOver read a screen aloud. It
/// removes the part a human is bad at: noticing that one control out of forty
/// lost its label.
final class AccessibilityTests: MiraUITestCase {
    /// Audits that apply to every screen.
    private var auditTypes: XCUIAccessibilityAuditType {
        [
            .contrast,
            .elementDetection,
            .hitRegion,
            .sufficientElementDescription,
            .textClipped,
            .trait,
        ]
    }

    func testClosetIsAccessible() throws {
        guard openCloset() else { return }
        try app.performAccessibilityAudit(for: auditTypes)
    }

    func testGarmentDetailIsAccessible() throws {
        guard openCloset() else { return }

        let tile = firstGarmentTile()
        XCTAssertTrue(tile.waitForExistence(timeout: 10), "no garment tile to open")
        tile.tap()

        // Detail is reached when the back control appears.
        XCTAssertTrue(
            app.buttons["Back"].waitForExistence(timeout: 15),
            "garment detail did not open"
        )
        try app.performAccessibilityAudit(for: auditTypes)
    }

    func testAddMenuIsAccessible() throws {
        guard openCloset() else { return }

        let add = app.buttons["Add to your closet"]
        XCTAssertTrue(add.waitForExistence(timeout: 10), "+ Add button missing its label")
        add.tap()

        XCTAssertTrue(
            app.staticTexts["Add to your closet"].waitForExistence(timeout: 15),
            "add menu did not open"
        )
        try app.performAccessibilityAudit(for: auditTypes)
    }

    /// Every garment tile must describe itself as one thing, not four fragments.
    ///
    /// `docs/02-design/accessibility.md` §4: a screen reader should hear the
    /// garment — "Zara satin midi dress, black, size small" — rather than a
    /// brand, then a name, then a size, with no relationship between them.
    func testGarmentTilesCarryAWholeDescription() throws {
        guard openCloset() else { return }

        let tiles = garmentTiles
        XCTAssertGreaterThan(tiles.count, 3, "expected several garment tiles")

        for index in 0..<min(tiles.count, 6) {
            let label = tiles.element(boundBy: index).label
            XCTAssertFalse(label.isEmpty, "a garment tile has no accessibility label")
            // Brand, name and colour · size are joined into one phrase.
            XCTAssertTrue(
                label.contains(","),
                "tile label is not a whole description: \(label)"
            )
        }
    }

    /// The favourite control on GARMENT DETAIL is a toggle that reports state.
    ///
    /// Colour alone must never carry meaning (A11Y-4) — a filled heart has to be
    /// announced as selected, not merely drawn differently.
    func testFavouriteControlReportsItsStateOnDetail() throws {
        guard openCloset() else { return }

        let tile = garmentTiles.firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 10), "no garment tile to open")
        tile.tap()
        XCTAssertTrue(
            app.buttons["Back"].waitForExistence(timeout: 15),
            "garment detail did not open"
        )

        let favourite = app.switches.matching(
            NSPredicate(
                format: "label BEGINSWITH[c] 'Favourite' OR label BEGINSWITH[c] 'Remove from favourites'"
            )
        ).firstMatch

        XCTAssertTrue(
            favourite.waitForExistence(timeout: 15),
            "no favourite control exposed as a toggle on garment detail"
        )
        XCTAssertNotNil(favourite.value, "favourite control does not report a state")
    }

    /// On the GRID the favourite state must still be audible.
    ///
    /// The tile is deliberately a single accessibility element, so the heart is
    /// not an element of its own — it is reached through the tile's `favorite`
    /// custom action. XCUITest cannot enumerate custom actions, so what is
    /// asserted here is the half that IS observable: that favourite state
    /// reaches the label rather than living only in the heart's fill colour.
    ///
    /// That the action itself is wired is covered by the unit test on
    /// `GarmentTile`; the VoiceOver rotor gesture remains a manual check
    /// (`docs/02-design/accessibility.md` §10).
    func testFavouriteStateIsAudibleOnTiles() throws {
        guard openCloset() else { return }

        // Nothing in the tree should expose a bare, orphaned favourite control:
        // if one appears on the closet it means the tile stopped being a single
        // element and shattered into fragments.
        let strayToggles = app.switches.matching(
            NSPredicate(format: "label CONTAINS[c] 'favourite'")
        )
        XCTAssertEqual(
            strayToggles.count, 0,
            "the garment tile should be one element, with favourite as a custom action"
        )

        // The realistic seed contains favourited garments, so at least one tile
        // on the first screenful announces the state.
        let favourited = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'Favourited'")
        )
        XCTAssertGreaterThan(
            favourited.count, 0,
            "no tile announces its favourite state — colour alone cannot carry it (A11Y-4)"
        )
    }

    private func firstGarmentTile() -> XCUIElement {
        garmentTiles.firstMatch
    }
}
