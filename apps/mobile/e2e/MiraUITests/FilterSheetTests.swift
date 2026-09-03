import XCTest

/// The filter sheet (task 1.8).
///
/// This is the one Phase 1 screen that cannot be reached by route — it is
/// component state, opened by a tap — which is why it stayed unverified until
/// there was a UI test target.
///
/// Two behaviours from `docs/02-design/screen-specs.md` §16 matter most, and
/// both are the kind of thing that silently regresses:
///
///   - filters apply on the CTA, not on every tap
///   - the CTA shows a LIVE count, so the user knows what they are about to get
final class FilterSheetTests: MiraUITestCase {
    func testFilterSheetOpensAndShowsALiveCount() throws {
        guard openCloset() else { return }

        let filter = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Filter'")
        ).firstMatch
        XCTAssertTrue(filter.waitForExistence(timeout: 10), "Filter control missing")
        filter.tap()

        XCTAssertTrue(
            app.staticTexts["Filter"].waitForExistence(timeout: 10),
            "filter sheet did not open"
        )

        // The CTA names a count before anything is applied.
        let cta = showButton()
        XCTAssertTrue(cta.waitForExistence(timeout: 15), "sticky CTA missing")
        XCTAssertTrue(
            cta.label.contains("piece"),
            "CTA should name how many pieces will show, got: \(cta.label)"
        )
    }

    /// Selecting a filter updates the count WITHOUT changing the grid behind it.
    ///
    /// Re-running the whole page on every tap is exactly what the mobile
    /// filtering research advises against, and it makes multi-select miserable.
    func testSelectingAFilterUpdatesTheCountButNotTheGrid() throws {
        guard openCloset() else { return }

        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Filter'"))
            .firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Filter"].waitForExistence(timeout: 10))

        let before = showButton().label

        let dresses = app.buttons["Dresses"].firstMatch
        XCTAssertTrue(dresses.waitForExistence(timeout: 10), "Dresses option missing")
        dresses.tap()

        // The count reacts...
        let changed = expectation(description: "CTA count changes")
        let poll = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { timer in
            if self.showButton().label != before {
                timer.invalidate()
                changed.fulfill()
            }
        }
        wait(for: [changed], timeout: 15)
        poll.invalidate()

        // ...but the sheet is still up, so nothing was applied behind it yet.
        XCTAssertTrue(
            app.staticTexts["Filter"].exists,
            "sheet closed on selection — filters must apply on the CTA"
        )
    }

    /// Applying narrows the grid, and the applied filter stays visible and
    /// removable in one tap.
    func testApplyingAFilterShowsARemovableChip() throws {
        guard openCloset() else { return }

        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Filter'"))
            .firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Filter"].waitForExistence(timeout: 10))

        app.buttons["Dresses"].firstMatch.tap()
        showButton().tap()

        // Back on the grid, the applied filter is visible as a dismissible chip.
        let chip = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] 'applied filter'")
        ).firstMatch
        XCTAssertTrue(
            chip.waitForExistence(timeout: 15),
            "applied filters must stay visible above the grid"
        )

        chip.tap()
        XCTAssertFalse(
            chip.waitForExistence(timeout: 5),
            "tapping an applied-filter chip should remove it"
        )
    }

    func testFilterSheetIsAccessible() throws {
        guard openCloset() else { return }

        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Filter'"))
            .firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Filter"].waitForExistence(timeout: 10))

        try app.performAccessibilityAudit(for: [
            .contrast,
            .elementDetection,
            .hitRegion,
            .sufficientElementDescription,
            .textClipped,
        ])
    }

    private func showButton() -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Show' OR label BEGINSWITH[c] 'No pieces'")
        ).firstMatch
    }
}
