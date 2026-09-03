import XCTest

/// Scroll performance on a realistically large closet.
///
/// Phase 1's exit criterion is "220-garment seed closet scrolls at 60 fps"
/// (`docs/08-engineering/implementation-plan.md`). That is the criterion because
/// the closet is the screen Maya opens most, it is image-heavy, and a janky grid
/// makes a premium product feel cheap in the first five seconds.
///
/// `scrollDecelerationMetric` measures hitches during the deceleration
/// after a flick, which is where dropped frames actually show up — a steady
/// slow drag hides them. Successive iterations continue down the grid rather
/// than resetting to the top: 224 garments over two columns is far more than
/// a handful of flicks can exhaust, and re-scrolling to the top between
/// passes would itself be measured.
///
/// These need the `realistic` seed:
///
///   npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
final class ClosetScrollTests: MiraUITestCase {
    func testClosetScrollsSmoothly() throws {
        guard openCloset() else { return }

        let grid = closetGrid
        XCTAssertTrue(grid.exists, "no scrollable closet grid found")

        // No `.manuallyStart`: the deceleration this metric samples happens
        // AFTER the flick gesture returns, so bracketing the swipe with
        // start/stopMeasuring closes the window before a single signpost is
        // emitted — the metric then fails to harvest rather than reporting a
        // bad number, which is a much more confusing way to break.
        measure(metrics: [XCTOSSignpostMetric.scrollDecelerationMetric]) {
            // No fixed sleep: XCTest waits for the app to idle before closing
            // the measured region, and idle includes deceleration. A sleep here
            // would dominate the duration and report a constant that says
            // nothing about how the grid actually scrolls.
            grid.swipeUp(velocity: .fast)
        }
    }

    /// Paging must keep loading as the user scrolls, without stalling or
    /// repeating rows — the grid fetches 40 at a time over 224 visible pieces.
    func testScrollingLoadsFurtherPages() throws {
        guard openCloset() else { return }

        let grid = closetGrid
        var seen = Set<String>()
        for _ in 0..<12 {
            let tiles = garmentTiles
            for index in 0..<tiles.count {
                let label = tiles.element(boundBy: index).label
                if !label.isEmpty { seen.insert(label) }
            }
            grid.swipeUp(velocity: .fast)
        }

        // Well past the first page of 40, so at least one more page was fetched
        // and rendered during the scroll.
        XCTAssertGreaterThan(
            seen.count, 45,
            "scrolling did not load beyond the first page — saw \(seen.count) distinct garments"
        )
    }

    /// The grid is two columns, never three (D-009).
    ///
    /// Asserted from the running app rather than from the token, because the
    /// token is only the intent — this checks what actually rendered.
    func testGridIsTwoColumns() throws {
        guard openCloset() else { return }

        let tiles = garmentTiles
        XCTAssertGreaterThan(tiles.count, 3, "expected several garment tiles")

        // Collect distinct x positions of the first row of tiles.
        var xPositions: [CGFloat] = []
        for index in 0..<min(tiles.count, 8) {
            let frame = tiles.element(boundBy: index).frame
            if !xPositions.contains(where: { abs($0 - frame.minX) < 4 }) {
                xPositions.append(frame.minX)
            }
        }

        XCTAssertEqual(
            xPositions.count, 2,
            "closet grid should have exactly two columns, found \(xPositions.count)"
        )
    }
}
