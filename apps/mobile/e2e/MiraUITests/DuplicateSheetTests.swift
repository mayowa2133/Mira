import XCTest

/// The duplicate resolution sheet (`docs/06-ai/duplicate-detection.md` §4).
///
/// Driven through the real form against the real API, because the thing being
/// tested is a sequence — check, then ask, then create with the answer — and
/// each step is a separate request. Unit tests cover the wording and the
/// scoring; only this covers whether the question actually appears.
final class DuplicateSheetTests: MiraUITestCase {
    /// A brand nothing else in the closet shares, so these tests cannot be
    /// answered by the seed data.
    private lazy var brand = "Testbrand\(Int(Date().timeIntervalSince1970) % 100000)"

    func testAddingTheSamePieceTwiceAsksBeforeSaving() throws {
        guard addPiece(name: "Contour Bodysuit") else { return }

        // Exactly the same garment again.
        guard openManualAdd() else { return }
        fillForm(name: "Contour Bodysuit")
        submit()

        let headline = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'already' AND label CONTAINS[c] 'closet'")
        ).firstMatch
        XCTAssertTrue(
            headline.waitForExistence(timeout: 30),
            "adding the same piece twice did not ask\n\n\(hierarchy())"
        )

        // §4 offers three answers, and no more.
        for relation in ["same_item", "owns_two", "different"] {
            XCTAssertTrue(
                app.buttons["duplicate-\(relation)"].exists,
                "the sheet is missing the \"\(relation)\" answer"
            )
        }
    }

    /// §1: "Mira must support legitimate duplicate ownership."
    func testOwningTwoCreatesTwo() throws {
        guard addPiece(name: "Ribbed Tank") else { return }

        guard openManualAdd() else { return }
        fillForm(name: "Ribbed Tank")
        submit()

        let ownsTwo = app.buttons["duplicate-owns_two"]
        guard ownsTwo.waitForExistence(timeout: 30) else {
            XCTFail("no duplicate sheet\n\n\(hierarchy())")
            return
        }
        ownsTwo.tap()

        // Landing on a garment detail is the save having gone through; the
        // sheet dismissing on its own would look identical if it had not.
        XCTAssertTrue(
            app.buttons["Back"].waitForExistence(timeout: 30)
                || app.staticTexts["Ribbed Tank"].waitForExistence(timeout: 5),
            "answering \"I own two\" did not save\n\n\(hierarchy())"
        )
    }

    /// A garment that resembles nothing is never interrupted.
    func testAnUnrelatedPieceSavesWithoutAQuestion() throws {
        guard openManualAdd() else { return }
        fillForm(name: "Something Nobody Owns \(UUID().uuidString.prefix(6))", brand: "Nobrand\(Int.random(in: 1000...9999))")
        submit()

        XCTAssertFalse(
            app.buttons["duplicate-same_item"].waitForExistence(timeout: 8),
            "an unrelated piece was treated as a duplicate\n\n\(hierarchy())"
        )
    }

    // MARK: - Helpers

    /// Add one garment and return to the closet.
    @discardableResult
    private func addPiece(name: String) -> Bool {
        guard openManualAdd() else { return false }
        fillForm(name: name)
        submit()

        // The first of a kind must not be questioned.
        if app.buttons["duplicate-same_item"].waitForExistence(timeout: 8) {
            XCTFail("the first piece of its kind was treated as a duplicate")
            return false
        }
        return true
    }

    /// Closet → "+ Add" → "Add manually".
    ///
    /// Always via the Closet tab, whose add control is in the header and is
    /// therefore there whether the closet is empty or full. The first version
    /// waited on Home's "Add your first piece" with the launch timeout before
    /// falling back — so on a closet with anything in it, it sat for two
    /// minutes looking for a button that was never going to appear.
    ///
    /// `openCloset()` in the base class is no use here: it waits for garment
    /// tiles, and half of what these tests do starts from an empty closet.
    private func openManualAdd() -> Bool {
        let tab = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Closet, tab'")
        ).firstMatch
        guard tab.waitForExistence(timeout: Self.launchTimeout) else {
            XCTFail("app never launched — is Metro running?")
            return false
        }
        tab.tap()

        let add = app.buttons["Add to your closet"]
        guard add.waitForExistence(timeout: 30) else {
            XCTFail("no way into the add flow\n\n\(hierarchy())")
            return false
        }
        add.tap()
        return tapAddManually()
    }

    private func tapAddManually() -> Bool {
        let manual = app.buttons["Add manually"]
        guard manual.waitForExistence(timeout: 20) else {
            XCTFail("the add menu never appeared\n\n\(hierarchy())")
            return false
        }
        manual.tap()
        return app.textFields["Brand"].waitForExistence(timeout: 20)
    }

    /// Fill the fields the moderate and strong signals are computed from.
    private func fillForm(name: String, brand: String? = nil) {
        type(into: "Brand", brand ?? self.brand)
        type(into: "Name", name)
        type(into: "Size", "S")

        // Category is required; colour and category are what make the pair
        // score at all (duplicate-detection.md §2).
        app.buttons["Tops"].firstMatch.tap()
        app.buttons["Black"].firstMatch.tap()
    }

    private func type(into label: String, _ text: String) {
        let field = app.textFields[label]
        guard field.waitForExistence(timeout: 10) else {
            XCTFail("no \"\(label)\" field\n\n\(hierarchy())")
            return
        }
        field.tap()
        field.typeText(text)
    }

    private func submit() {
        let button = app.buttons["Add to my closet"]
        if !button.exists {
            // The button sits below the fold once the keyboard is up.
            app.swipeUp()
        }
        button.tap()
    }
}
