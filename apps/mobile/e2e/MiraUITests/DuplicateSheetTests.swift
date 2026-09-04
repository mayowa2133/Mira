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

        // Either band's wording. Which one depends on the score, and this test
        // is about being ASKED — the first version demanded the confident
        // phrasing ("...already in your closet") and failed against the soft
        // one ("Is this one you already own?"), which is the correct wording
        // for a very similar name plus the same colour and size (§7).
        let headline = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] 'already'")
        ).firstMatch
        XCTAssertTrue(
            headline.waitForExistence(timeout: 30),
            "adding the same piece twice did not ask\n\n\(hierarchy())"
        )

        // And it says WHY, in words rather than a score.
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Same brand'"))
                .firstMatch.exists,
            "the sheet did not say what it noticed"
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

    /// Add one garment, then get back to somewhere the tab bar exists.
    ///
    /// A successful save lands on garment detail, which is a stack route
    /// OUTSIDE `(tabs)` and therefore has no tab bar — so the next
    /// `openManualAdd()` waits for a Closet tab that is not on screen.
    ///
    /// Relaunching is the way back, and it is worth more than a Back tap: the
    /// second add then runs against a process that has never seen the first
    /// garment in memory, so a duplicate it finds can only have come from the
    /// server.
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

        app.launch()
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
    ///
    /// Chips BEFORE text. The category and colour chips sit above the text
    /// fields, and once the keyboard is up they scroll out of reach — a tap
    /// then lands on nothing, the form stays invalid, and `GarmentForm` makes
    /// an invalid submit a silent no-op. The screen simply does not move, which
    /// looks exactly like a slow launch from the outside.
    private func fillForm(name: String, brand: String? = nil) {
        select("Tops")
        select("Black")
        enter("Brand", brand ?? self.brand)
        enter("Name", name)
        enter("Size", "S")
    }

    /// Tap a chip, and prove it took.
    ///
    /// A chip that did not register is invisible as a failure: the form stays
    /// invalid and the submit button does nothing at all. The chip relabels
    /// itself ", selected" when active, so the state is observable.
    private func select(_ label: String) {
        let chip = app.buttons[label]
        guard chip.waitForExistence(timeout: 15) else {
            XCTFail("no \"\(label)\" chip on the form\n\n\(hierarchy())")
            return
        }
        chip.tap()

        XCTAssertTrue(
            app.buttons["\(label), selected"].waitForExistence(timeout: 5),
            "tapping \"\(label)\" did not select it — the form will silently refuse to submit"
        )
    }

    /// Type into a labelled field, and prove the field got what was typed.
    ///
    /// NOT called `type(into:_:)`. That shadows Swift's own `type(of:)`, and
    /// when this helper briefly went missing the compiler resolved the calls to
    /// the builtin and failed only the TEST target — `test-without-building`
    /// then happily ran the previous bundle, reporting results for code that no
    /// longer existed.
    ///
    /// The read-back is not belt and braces. React Native's TextInput is
    /// controlled: every keystroke round-trips through JavaScript and comes back
    /// as a new `value`, and synthetic typing outruns that. It dropped
    /// characters here for real — "Testbrand31320" arrived as "Tand31320",
    /// which is a different brand, so the app correctly declined to see a
    /// duplicate and the test blamed the product for its own typo.
    private func enter(_ label: String, _ text: String) {
        let field = app.textFields[label]
        guard field.waitForExistence(timeout: 10) else {
            XCTFail("no \"\(label)\" field\n\n\(hierarchy())")
            return
        }

        for attempt in 1...3 {
            field.tap()

            // Clear whatever a previous attempt left behind. An empty
            // TextInput reports its placeholder as its value, so that is not
            // "existing text".
            let current = field.value as? String
            if let current, !current.isEmpty, current != field.placeholderValue {
                field.press(forDuration: 1.0)
                let selectAll = app.menuItems["Select All"]
                if selectAll.waitForExistence(timeout: 2) { selectAll.tap() }
                field.typeText(XCUIKeyboardKey.delete.rawValue)
            }

            field.typeText(text)
            if (field.value as? String) == text { return }

            if attempt == 3 {
                XCTFail(
                    "\"\(label)\" holds \(String(describing: field.value)) after typing \"\(text)\""
                )
            }
        }
    }

    /// Submit, and prove the form actually left.
    ///
    /// An invalid form makes this button inert, so "nothing happened" has to be
    /// a failure here rather than a timeout somewhere later that reads as a
    /// slow launch.
    private func submit() {
        // Dismiss the keyboard so the CTA is not under it.
        if app.keyboards.count > 0 {
            app.typeText("\n")
        }

        let button = app.buttons["Add to my closet"]
        if !button.exists { app.swipeUp() }
        guard button.waitForExistence(timeout: 10) else {
            XCTFail("no submit button\n\n\(hierarchy())")
            return
        }
        button.tap()

        // Either the sheet asks, or the form is gone. Both are "it submitted".
        let asked = app.buttons["duplicate-same_item"]
        let left = app.staticTexts["Add a piece"]
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            if asked.exists || !left.exists { return }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail(
            "the form did not submit — it is still on screen and nothing was asked\n\n\(hierarchy())"
        )
    }
}
