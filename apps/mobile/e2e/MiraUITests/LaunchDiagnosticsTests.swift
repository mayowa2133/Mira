import XCTest

/// Deliberately non-asserting tests that print what the app actually exposes to
/// the accessibility tree.
///
/// They exist because a `waitForExistence` timeout tells you that something was
/// absent, but never what was present instead — which is the only fact that
/// distinguishes "wrong query" from "real accessibility bug".
final class LaunchDiagnosticsTests: MiraUITestCase {
    func testDumpLaunchHierarchy() throws {
        _ = app.wait(for: .runningForeground, timeout: Self.launchTimeout)
        _ = app.buttons.firstMatch.waitForExistence(timeout: Self.launchTimeout)

        print("=== MIRA LAUNCH HIERARCHY ===")
        print(hierarchy(limit: 20000))
        print("=== END MIRA LAUNCH HIERARCHY ===")
    }

    /// What a garment tile exposes, and whether the favourite control survives
    /// into the tree at all.
    func testDumpClosetHierarchy() throws {
        guard openCloset() else { return }

        print("=== MIRA CLOSET HIERARCHY ===")
        print(hierarchy(limit: 24000))
        print("=== END MIRA CLOSET HIERARCHY ===")

        print("=== ELEMENT COUNTS ===")
        print("buttons: \(app.buttons.count)")
        print("switches: \(app.switches.count)")
        print("scrollViews: \(app.scrollViews.count)")
        print("garmentTiles: \(garmentTiles.count)")

        // Anything, of any type, carrying the favourite label.
        let favouriteLabelled = app.descendants(matching: .any).matching(
            NSPredicate(
                format: "label CONTAINS[c] 'Favourite' OR label CONTAINS[c] 'favourites'"
            )
        )
        print("elements labelled favourite (any type): \(favouriteLabelled.count)")
        for index in 0..<min(favouriteLabelled.count, 5) {
            let element = favouriteLabelled.element(boundBy: index)
            print("  [\(index)] type=\(element.elementType.rawValue) label='\(element.label)' value=\(String(describing: element.value))")
        }
        print("=== END ELEMENT COUNTS ===")
    }
}
