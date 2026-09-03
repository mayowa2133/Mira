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

            // A garment straight off the camera has no brand, name or colour
            // yet — that is what analysis is for — so it announces its state
            // instead. Requiring a comma there would demand Mira invent
            // attributes it does not know.
            let isAnalyzing = label.contains("Still being analyzed")
            XCTAssertTrue(
                isAnalyzing || label.contains(","),
                "tile label is neither a whole description nor a state: \(label)"
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
    /// custom action (D-016). XCUITest cannot enumerate custom actions, so what
    /// is asserted is the half that IS observable: that favourite state reaches
    /// the label rather than living only in the heart's fill colour (A11Y-4).
    ///
    /// The state is created here rather than assumed from the seed. An earlier
    /// version looked for an already-favourited garment on the first screenful,
    /// which broke the moment newly captured garments arrived at the top of the
    /// closet — a test that depended on what the seed happened to put in view.
    func testFavouriteStateIsAudibleOnTiles() throws {
        guard openCloset() else { return }

        // No orphaned toggle on the grid: if one appears, the tile has stopped
        // being a single element and shattered into fragments.
        XCTAssertEqual(
            app.switches.matching(NSPredicate(format: "label CONTAINS[c] 'favourite'")).count,
            0,
            "the garment tile should be one element, with favourite as a custom action"
        )

        let tile = garmentTiles.firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 15), "no garment tile to favourite")
        let labelBefore = tile.label
        tile.tap()

        // Favourite it from detail, where the control is a real toggle.
        let favourite = app.switches.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Favourite'")
        ).firstMatch
        XCTAssertTrue(favourite.waitForExistence(timeout: 15), "no favourite toggle on detail")
        favourite.tap()

        app.buttons["Back"].tap()

        // Back on the grid, the same tile now says so.
        let favourited = app.buttons.matching(identifier: "garment-tile").matching(
            NSPredicate(format: "label CONTAINS[c] 'Favourited'")
        ).firstMatch

        XCTAssertTrue(
            favourited.waitForExistence(timeout: 20),
            """
            Favouriting a garment did not change what its tile announces —
            colour alone cannot carry the state (A11Y-4). Tile was: \(labelBefore)
            """
        )
    }

    private func firstGarmentTile() -> XCUIElement {
        garmentTiles.firstMatch
    }
}
