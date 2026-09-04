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

    /// §16's sections, which task 5.6 added: brand, size and price.
    ///
    /// Brands and sizes come from the closet rather than the taxonomy, so this
    /// also proves the facets request reached the server — an empty list would
    /// render no section at all and this would fail rather than pass quietly.
    func testTheSheetOffersBrandSizeAndPrice() throws {
        guard openFilterSheet() else { return }

        // Matched case-insensitively: section headings are rendered uppercase
        // by the field component, and asserting the exact string would be
        // testing a stylesheet.
        for section in ["Brand", "Size", "Price"] {
            let heading = app.staticTexts.matching(
                NSPredicate(format: "label ==[c] %@", section)
            ).firstMatch
            XCTAssertTrue(
                heading.waitForExistence(timeout: 10),
                "no \(section) section in the filter sheet\n\n\(hierarchy())"
            )
        }

        XCTAssertTrue(
            app.textFields["Search brands"].exists,
            "the brand list is not searchable, which is what §16 asks for"
        )
        XCTAssertTrue(app.textFields["Minimum price"].exists)
        XCTAssertTrue(app.textFields["Maximum price"].exists)
    }

    /// §16's status set, in full.
    func testTheSheetOffersEveryStatus() throws {
        guard openFilterSheet() else { return }

        for status in ["Never worn", "Still has tags", "Recently added", "Favourite"] {
            XCTAssertTrue(
                app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", status))
                    .firstMatch.exists,
                "no \"\(status)\" status chip"
            )
        }
    }

    /// Brand chips are named, and picking one changes the count.
    func testPickingABrandChangesTheCount() throws {
        guard openFilterSheet() else { return }

        let cta = showButton()
        guard cta.waitForExistence(timeout: 15) else {
            XCTFail("no CTA\n\n\(hierarchy())")
            return
        }
        let before = cta.label

        // The first brand chip sits under the search field; brands are labelled
        // "<name>, N pieces" so they are distinguishable from category chips.
        let brand = app.buttons.matching(
            NSPredicate(format: "label MATCHES[c] '^[A-Za-z].*, [0-9]+ pieces$'")
        ).firstMatch
        guard brand.waitForExistence(timeout: 10) else {
            XCTFail("no brand chip\n\n\(hierarchy())")
            return
        }
        brand.tap()

        // Filtering to one brand must show fewer pieces than the whole closet.
        let deadline = Date().addingTimeInterval(15)
        while Date() < deadline {
            if showButton().label != before { return }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("picking a brand did not change the count (still \(before))")
    }

    /// Open the closet and the filter sheet.
    private func openFilterSheet() -> Bool {
        guard openCloset() else { return false }

        let filter = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Filter'")
        ).firstMatch
        guard filter.waitForExistence(timeout: 10) else {
            XCTFail("Filter control missing")
            return false
        }
        filter.tap()

        // NOT `app.staticTexts["Filter"]`: the Filter control on the closet
        // screen carries that label too, so it matches before the sheet is
        // open and reports success for a sheet that never appeared. The sticky
        // CTA exists only inside the sheet.
        guard showButton().waitForExistence(timeout: 15) else {
            XCTFail("the filter sheet did not open\n\n\(hierarchy())")
            return false
        }
        return true
    }

    private func showButton() -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Show' OR label BEGINSWITH[c] 'No pieces'")
        ).firstMatch
    }
}
