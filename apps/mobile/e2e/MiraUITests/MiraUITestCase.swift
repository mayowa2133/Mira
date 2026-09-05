import XCTest

/// Shared setup for Mira's UI tests.
///
/// These run against the real stack — Postgres with the `realistic` seed and the
/// API — because what is being tested is scroll behaviour over a genuinely large
/// closet and the accessibility of real content. A stubbed screen with four
/// garments would prove neither.
///
///   npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
///   npm run api
///
/// See `docs/08-engineering/testing-strategy.md`.
class MiraUITestCase: XCTestCase {
    var app: XCUIApplication!

    /// Generous, because a debug build fetches its bundle from Metro on launch.
    static let launchTimeout: TimeInterval = 120

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Element queries

    /// Garment tiles, by identifier.
    ///
    /// Emphatically NOT by label. The first version of this suite matched "any
    /// button whose label contains a comma", which also matched the tab items
    /// ("Closet, tab, 2 of 5") and the selected category chip ("All, selected").
    /// Tests then measured chrome instead of content — and passed, which is
    /// worse than failing.
    var garmentTiles: XCUIElementQuery {
        app.buttons.matching(identifier: "garment-tile")
    }

    /// Captures that are on the device but not yet on the server.
    ///
    /// Matched across ALL element types, not `app.buttons`. A pending tile is
    /// an `image` until it fails and becomes a tappable `button` — the role
    /// legitimately changes with its state, so a query that pins a type finds
    /// nothing exactly when the capture is behaving normally.
    var pendingCaptures: XCUIElementQuery {
        app.descendants(matching: .any).matching(identifier: "pending-capture")
    }

    /// The closet grid, chosen by height.
    ///
    /// Not `scrollViews.firstMatch`: the category chip row is a horizontal
    /// ScrollView that renders ABOVE the grid, so "first" is the chip row and a
    /// swipe on it scrolls nothing.
    var closetGrid: XCUIElement {
        let scrollViews = app.scrollViews
        var tallest: XCUIElement?
        var tallestHeight: CGFloat = 0
        for index in 0..<scrollViews.count {
            let candidate = scrollViews.element(boundBy: index)
            guard candidate.exists else { continue }
            let height = candidate.frame.height
            if height > tallestHeight {
                tallestHeight = height
                tallest = candidate
            }
        }
        return tallest ?? scrollViews.firstMatch
    }

    /// The Closet tab.
    private func closetTab() -> XCUIElement {
        app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH[c] 'Closet, tab'")
        ).firstMatch
    }

    // MARK: - Navigation

    /// Navigate to the closet and wait for real content.
    ///
    /// The tests drive navigation themselves rather than relying on the
    /// `EXPO_PUBLIC_DEV_INITIAL_ROUTE` launch override — a test that only passes
    /// when an environment variable happens to be set is a test that will lie
    /// later.
    /// Names the screen when the tab bar is missing, so the failure says which
    /// of its two causes actually happened instead of leaving it to be guessed.
    func onboardingHint() -> String {
        if app.staticTexts["Your closet. Your stylist. Your mirror."].exists {
            return "the Welcome screen — the app is signed out, not un-bundled"
        }
        if app.buttons["Get started"].exists {
            return "onboarding — the app is signed out, not un-bundled"
        }
        if app.staticTexts.count == 0 {
            return "nothing at all — the bundle probably never loaded"
        }
        return "something without a tab bar"
    }

    @discardableResult
    func openCloset(file: StaticString = #filePath, line: UInt = #line) -> Bool {
        let tab = closetTab()
        guard tab.waitForExistence(timeout: Self.launchTimeout) else {
            XCTFail(
                """
                Closet tab never appeared within \(Self.launchTimeout)s.

                There is no tab bar on the onboarding stack, so the usual cause \
                is NOT a dead bundler: the app launched and routed to Welcome \
                because /v1/me did not return a signed-in user. Check that the \
                API is up AND that it accepts EXPO_PUBLIC_DEV_AUTH_TOKEN — a \
                401 there is indistinguishable from a real sign-out, and the \
                app is right to show Welcome.

                Second cause: Metro is not serving the bundle.

                On screen now: \(onboardingHint())

                \(hierarchy())
                """,
                file: file,
                line: line
            )
            return false
        }
        tab.tap()

        // The tab label and the screen header are both the word "Closet", so
        // real garment content is the only unambiguous signal that the screen
        // actually loaded.
        guard garmentTiles.firstMatch.waitForExistence(timeout: 60) else {
            XCTFail(
                """
                No garments rendered — is the API running and the closet seeded?

                \(hierarchy())
                """,
                file: file,
                line: line
            )
            return false
        }
        return true
    }

    // MARK: - Diagnostics

    /// The on-screen element tree, trimmed to something a CI log can carry.
    func hierarchy(limit: Int = 6000) -> String {
        let description = app.debugDescription
        return description.count > limit
            ? String(description.prefix(limit)) + "\n… (truncated)"
            : description
    }

    /// The distinct accessibility labels currently on screen.
    func visibleTileLabels() -> Set<String> {
        var labels = Set<String>()
        let tiles = garmentTiles
        for index in 0..<tiles.count {
            let label = tiles.element(boundBy: index).label
            if !label.isEmpty { labels.insert(label) }
        }
        return labels
    }
}
