import XCTest

/// Photo capture (Phase 2, tasks 2.1/2.2/2.6/2.7).
///
/// The simulator has no camera, so the shutter itself cannot be exercised here —
/// what can be, and is what actually carries the risk, is everything around it:
/// that the camera screen renders the restrained chrome §9 specifies, that the
/// photo-library route reaches a real picker, and that a chosen photo becomes a
/// pending tile in the closet and then a garment.
///
/// Needs the API running and the simulator's photo library seeded:
///
///   xcrun simctl addmedia <udid> some-photo.jpg
final class CaptureFlowTests: MiraUITestCase {
    /// `docs/02-design/screen-specs.md` §9 is mostly a list of what must NOT be
    /// on this screen, so that is what this asserts.
    func testCameraScreenIsTheRestrainedOneTheSpecDescribes() throws {
        guard openAddMenu() else { return }

        app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Scan an item'")
        ).firstMatch.tap()

        // The camera may ask for permission the first time; either way the
        // screen must offer a way forward.
        allowSystemPermissionIfPresented()

        let shutter = app.buttons["Take photo"]
        let permissionPrompt = app.staticTexts["Mira needs the camera to scan your clothes."]

        XCTAssertTrue(
            shutter.waitForExistence(timeout: 20) || permissionPrompt.waitForExistence(timeout: 5),
            "camera screen showed neither a shutter nor a permission explanation"
        )

        if permissionPrompt.exists {
            // Denied camera is not a dead end (states-and-errors §5).
            XCTAssertTrue(
                app.buttons["Choose a photo instead"].exists,
                "a denied camera must still offer the photo library"
            )
            return
        }

        XCTAssertTrue(app.staticTexts["Place one item in frame"].exists, "the hint is missing")
        XCTAssertTrue(app.buttons["Upload a photo instead"].exists)
        XCTAssertTrue(app.buttons["Close camera"].exists)

        // What must NOT be here: the tab bar, and anything filter-shaped.
        XCTAssertFalse(
            app.buttons.matching(NSPredicate(format: "label CONTAINS[c] ', tab,'")).firstMatch.exists,
            "the camera must have no tab bar (screen-specs.md §9)"
        )
        XCTAssertFalse(
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Filter'")).firstMatch.exists,
            "the camera must have no filter chrome (screen-specs.md §9)"
        )
    }

    /// The whole point of Phase 2: a photo becomes a garment.
    ///
    /// Goes through the photo library rather than the shutter, because the
    /// simulator has no camera — but everything after the image is chosen is the
    /// same code path as a capture.
    func testChoosingAPhotoPutsItInTheCloset() throws {
        guard openAddMenu() else { return }

        let choosePhoto = app.buttons["Choose a photo"]
        XCTAssertTrue(choosePhoto.waitForExistence(timeout: 10), "no 'Choose a photo' option")
        choosePhoto.tap()

        allowSystemPermissionIfPresented()

        // The system picker. Its internals are Apple's, so this looks for any
        // image cell rather than pinning a private identifier.
        let photo = app.images.matching(
            NSPredicate(format: "label CONTAINS[c] 'Photo' OR label CONTAINS[c] 'photo'")
        ).firstMatch

        guard photo.waitForExistence(timeout: 25) else {
            XCTFail(
                """
                The photo picker never presented an image. Seed the simulator:
                  xcrun simctl addmedia <udid> some-photo.jpg

                \(hierarchy())
                """
            )
            return
        }
        // A coordinate tap, not `photo.tap()`.
        //
        // expo-image-picker uses PHPickerViewController, which renders OUT OF
        // PROCESS: the cells are visible to the accessibility tree but report
        // `isHittable == false` forever, because the hit test belongs to another
        // process. Waiting for hittability here polls until timeout every time.
        photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        // The capture is now in the closet.
        //
        // Deliberately NOT asserting on the pending tile alone. Pending is a
        // transient state: on a fast local network the upload finishes and the
        // entry is swept before an assertion can run, so a test that required it
        // would fail precisely when the app performed BEST. What the user is
        // owed is that their photo is in their closet — pending or finished.
        let analyzing = app.buttons.matching(identifier: "garment-tile").matching(
            NSPredicate(format: "label CONTAINS[c] 'Still being analyzed'")
        ).firstMatch

        let arrived = pendingCaptures.firstMatch.waitForExistence(timeout: 5)
            || analyzing.waitForExistence(timeout: 45)

        XCTAssertTrue(
            arrived,
            """
            The chosen photo never appeared in the closet, as either a pending
            capture or an analyzing garment.

            \(hierarchy())
            """
        )
    }

    // MARK: - Helpers

    private func openAddMenu() -> Bool {
        guard openCloset() else { return false }

        let add = app.buttons["Add to your closet"]
        guard add.waitForExistence(timeout: 10) else {
            XCTFail("no + Add control on the closet")
            return false
        }
        add.tap()

        guard app.staticTexts["Add to your closet"].waitForExistence(timeout: 15) else {
            XCTFail("the add menu did not open")
            return false
        }
        return true
    }

    /// Grant a system permission alert if one is on screen.
    ///
    /// `addUIInterruptionMonitor` is unreliable for permissions presented during
    /// an explicit tap — the handler only runs when the test next interacts with
    /// the app — so springboard is queried directly.
    private func allowSystemPermissionIfPresented() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

        for label in ["Allow Full Access", "Allow", "Allow Access to All Photos", "OK"] {
            let button = springboard.buttons[label]
            if button.waitForExistence(timeout: 3) {
                button.tap()
                return
            }
        }
    }
}
