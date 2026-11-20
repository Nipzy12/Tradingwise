# Tradingwise Desktop Workspace & Drawing QA (November 2026)

This is an original implementation informed by observed TradingView Supercharts user interactions, not a copy of TradingView proprietary code, design assets or Advanced Charts.

## Scope and evidence
- TradingView signed-in desktop observations: top-left symbol / timeframe / indicators / alert / replay, left drawing groups, bottom range strip, right watchlist / alerts / object tree; two-click trendline and Fibonacci retracement exercised via visible UI.
- The categories are based on the already existing Tradingwise mobile drawing group taxonomy, which closely follows the observed broad categories. No missing/unimplemented tool is listed as functional.
- Actual TradingView Gann, advanced pattern, broker, and subscription-only behavior was **not** comprehensively verified; menu and settings observations should not be mistaken for successful placements.
- Desktop browser smoke is run at 1440 × 900 with deterministic candle fixtures and mocked market transport; Android smoke remains at 393 × 852 with its own gestures.

## Desktop layout
- Compact top header with symbol / timeframe / chart type / indicators / alert / replay / undo / redo / layout / save, followed by settings and other actions. The header can scroll horizontally if the viewport is narrow.
- Left rail presents cursor, trend, Fibonacci / Gann, patterns, projection / positions, geometric shapes, annotations, visual icons, SMC / ICT, and measurement in fixed order. Click a category to open an anchored tool flyout; choose any supported tool or star a favorite.
- The separate all-tools search still exists, but now displays the same desktop category organization instead of fragmented basic/advanced groups.
- Watchlist expands by default on desktop; existing desktop preferences receive a one-time expansion migration. User collapse/expand choices after migration remain saved.
- Favorites float above the chart rather than adding a second permanent header row. Bottom range strip includes 1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y and All, computed from actual provider candles. A selected period cannot display data older than the loaded history.
- The desktop change intentionally does not replace the mobile drawing bottom sheet or mobile navigation.

## Available tools and limits
- Every entry shown in desktop drawing groups is backed by TOOL_CATALOG and a drawing engine operation. The catalog has unit coverage for placement, rendering, object lifecycle, undo/redo, Fibonacci, time/price anchors and position calculations.
- Fib Spiral uses a geometric golden-spiral path. Gann Square and Gann Square Fixed are screen-relative square-grid geometries. Pitchfan uses three anchor-relative lines. These are independent drawing approximations, not exact TradingView numerical implementations or prediction tools.
- Volume profile uses estimated bar-volume assignment, not tick-level price-at-volume. No unsupported strategy, Pine, image upload, AI tool, broker execution or cloud drawing sync is implied.
- Text and icon placement can prompt for user-supplied labels. Position and risk calculations are estimates that omit broker spread, fees and margin constraints.

## Verification
Run `npm test` for drawing model/UI unit and integration cases. Build the static frontend, install Playwright + Chromium and run `node scripts/mobile-smoke.mjs` to verify mobile and desktop viewport geometry, all 10 desktop flyouts, favorites, actual multi-anchor drawing, lower and right pane navigation, and screen overflow. The scripted market transport is a fixture; real-device, real-provider and exact TradingView parity testing remain separate tasks.
