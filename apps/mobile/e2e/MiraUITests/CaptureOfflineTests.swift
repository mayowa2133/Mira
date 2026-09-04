import XCTest

/// The Phase 2 exit criterion: "airplane-mode capture uploads on reconnect."
///
/// These two tests are halves of ONE scenario and are run as separate
/// `xcodebuild` invocations, with the API stopped for the first and started
/// before the second (`scripts/verify-offline-capture.sh`). That is the only
/// honest way to test it: the app cannot stop its own backend, and a test that
/// simulated the network at the queue level would be re-testing the unit tests
/// rather than the thing itself.
///
/// The app is relaunched between them, so this also covers the harder half of
/// task 2.2 — that a capture survives the process dying while it is still owed.
final class CaptureOfflineTests: MiraUITestCase {
    /// With the API unreachable, a captured photo must still be visible and
    /// must not be lost (REL-2).
    func testCaptureSurvivesAnUnreachableServer() throws {
        guard openAddMenuAllowingEmptyCloset() else { return }

        let choosePhoto = app.buttons["Choose a photo"]
        XCTAssertTrue(choosePhoto.waitForExistence(timeout: 15), "no 'Choose a photo' option")
        choosePhoto.tap()

        allowSystemPermissionIfPresented()

        let photo = app.images.matching(
            NSPredicate(format: "label CONTAINS[c] 'Photo' OR label CONTAINS[c] 'photo'")
        ).firstMatch
        guard photo.waitForExistence(timeout: 25) else {
            XCTFail("the photo picker never presented an image\n\n\(hierarchy())")
            return
        }
        // Out-of-process picker: coordinates, not hit tests.
        photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        // The photograph is in the closet even though nothing could be uploaded.
        XCTAssertTrue(
            pendingCaptures.firstMatch.waitForExistence(timeout: 30),
            "an offline capture left no pending tile — the photo is invisible\n\n\(hierarchy())"
        )

        // And it stays. A queue that quietly dropped the entry on failure would
        // pass the assertion above and still lose the user's photo.
        Thread.sleep(forTimeInterval: 6)
        XCTAssertGreaterThan(
            pendingCaptures.count, 0,
            "the pending capture disappeared while the server was unreachable"
        )
    }

    /// With the API back, the queued capture uploads without the user doing
    /// anything.
    func testQueuedCaptureUploadsOnReconnect() throws {
        // A fresh launch: the queue is read back from disk, and anything left
        // mid-flight is retried (task 2.2).
        XCTAssertTrue(
            closetTabExists(timeout: Self.launchTimeout),
            "app never finished launching"
        )
        guard openCloset() else { return }

        // No tap, no retry button: the queue drains on its own.
        let deadline = Date().addingTimeInterval(90)
        while Date() < deadline {
            if pendingCaptures.count == 0 { return }
            _ = app.wait(for: .runningForeground, timeout: 2)
        }

        XCTFail(
            """
            A capture queued while offline never uploaded after reconnect.
            Still pending: \(pendingCaptures.count)

            \(hierarchy())
            """
        )
    }

    // MARK: - Helpers

    /// Reaching the add menu must work even when the closet cannot load, which
    /// is exactly the case while the API is down.
    private func openAddMenuAllowingEmptyCloset() -> Bool {
        guard closetTabExists(timeout: Self.launchTimeout) else {
            XCTFail("app never finished launching — is Metro running?")
            return false
        }
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Closet, tab'"))
            .firstMatch.tap()

        let add = app.buttons["Add to your closet"]
        guard add.waitForExistence(timeout: 20) else {
            XCTFail("no + Add control on the closet\n\n\(hierarchy())")
            return false
        }
        add.tap()

        guard app.staticTexts["Add to your closet"].waitForExistence(timeout: 15) else {
            XCTFail("the add menu did not open")
            return false
        }
        return true
    }

    private func closetTabExists(timeout: TimeInterval) -> Bool {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH[c] 'Closet, tab'"))
            .firstMatch.waitForExistence(timeout: timeout)
    }

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
