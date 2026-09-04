import XCTest

/// Wardrobe insights (`docs/02-design/screen-specs.md` §26).
///
/// The exit criterion for this phase is a judgement — "no screen in this phase
/// reads as a dashboard" — which no test can settle. What a test CAN hold is
/// the structural half of it: that the numbers are collapsed until asked for,
/// and that a rail leads with a sentence rather than a metric.
final class InsightsTests: MiraUITestCase {
    func testInsightsLeadWithSentencesAndImagery() throws {
        guard openInsights() else { return }

        // A headline is a sentence about the closet, not a label on a figure.
        let headline = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'deserve another chance'")
        ).firstMatch
        XCTAssertTrue(
            headline.waitForExistence(timeout: 20),
            "no insight headline on screen\n\n\(hierarchy())"
        )

        // And there is imagery under it.
        XCTAssertGreaterThan(
            app.buttons.matching(identifier: "rail-garment").count,
            0,
            "an insight rail with no garments is a dashboard row"
        )
    }

    /// §26: closet value and cost per wear are "optional, collapsed by default".
    func testTheNumbersAreCollapsedUntilAskedFor() throws {
        guard openInsights() else { return }

        let toggle = app.buttons["Show the numbers"]
        XCTAssertTrue(
            toggle.waitForExistence(timeout: 20),
            "the numbers section is missing entirely\n\n\(hierarchy())"
        )

        // Nothing money-shaped on screen before it is opened.
        XCTAssertEqual(
            app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] 'a wear, on average'")
            ).count,
            0,
            "cost per wear is visible without being asked for"
        )

        toggle.tap()

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'across'"))
                .firstMatch.waitForExistence(timeout: 10),
            "opening the numbers showed nothing\n\n\(hierarchy())"
        )
    }

    /// Every rail garment names itself, rather than announcing a position.
    func testRailGarmentsAreIdentifiable() throws {
        guard openInsights() else { return }

        let rail = app.buttons.matching(identifier: "rail-garment")
        guard rail.firstMatch.waitForExistence(timeout: 20) else {
            XCTFail("no rail garments\n\n\(hierarchy())")
            return
        }

        for index in 0..<min(rail.count, 4) {
            let label = rail.element(boundBy: index).label
            XCTAssertFalse(label.isEmpty, "a rail garment has no accessibility label")
            // The same rule as a closet tile: never a bare glyph, never nothing.
            XCTAssertFalse(label == "♡" || label == "♥", "a rail garment announced a glyph")
        }
    }

    // MARK: - Helpers

    /// Home → "See all". The insights screen lives in the Home stack
    /// (`navigation.md`).
    private func openInsights() -> Bool {
        guard app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Home, tab'"))
            .firstMatch.waitForExistence(timeout: Self.launchTimeout)
        else {
            XCTFail("app never finished launching — is Metro running?")
            return false
        }

        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Home, tab'"))
            .firstMatch.tap()

        let seeAll = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'See all'")
        ).firstMatch

        guard seeAll.waitForExistence(timeout: 30) else {
            XCTFail(
                """
                No "See all" on Home — either the closet is too small for
                insights, or the rails did not load.

                \(hierarchy())
                """
            )
            return false
        }
        seeAll.tap()

        return app.staticTexts["Your closet lately"].waitForExistence(timeout: 20)
    }
}
