# Tradingwise Drawing Studio v1
## Research and implementation choices
Public TradingView Supercharts and official help were used as behavioral references. The unsigned public session rendered the toolbars, chart and watchlist but selecting Trendline presented a sign-in/join prompt; actual signed-in drawing behavior was not directly observed. Tradingwise uses original implementations and the existing open-source chart engine, not TradingView's proprietary Advanced Charts sources.
References:
- https://www.tradingview.com/support/solutions/43000746464-getting-started-with-supercharts/
- https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/
- https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/
- https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/
- https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/
## Using the tools
Open Drawing Studio from the grid button on the desktop left toolbar or the mobile drawing button. Search by name; star individual tools to add to the desktop Favorites toolbar (also available under Favorites inside the mobile palette).
- One point: tap a chart location (horizontal/vertical, cross line, horizontal ray, price label, liquidity, text).
- Two points: tap start/end or drag start to end (trend, ray, extended, arrow, rectangle, ellipse, Fibonacci retracement, measurements, long/short, OB/FVG manual zones).
- Three points: tap three anchors or drag initial baseline, then tap third anchor (parallel channel, triangle, fib extension).
- Brush/highlighter: drag freely.
- Pointer: select existing object, drag its body or individual handles, edit using floating properties bar or double-click/right-click. Locked objects cannot be moved by pointer; object tree remains the place to unlock. Delete removes selection. Brush is moved as one object.
- Object Tree: select, edit, lock, hide, duplicate, delete independently. Data Window displays raw candle OHLC (formatted in selected display currency) and volume.
- Magnet: off, weak (13 CSS-pixel proximity), strong (nearest OHLC at rounded candle index); keep drawing repeats tool; lock/hide all affects manual drawings in active chart.
- Settings: style, text, price and UTC time anchors, Fibonacci level list; save preferred tool defaults locally. Position displays adjustable entry/TP/SL and risk size, with 2:1 initial RR and native quote/contract-size unit assumptions (no broker margin, lot steps, spread, commissions).
- Drawings are manual annotations, not generated trade signals; OB/FVG/Liquidity names are manual placement, not auto-detection.
- New objects store UTC time and provider price, retain logical fallbacks for old workspace files. Drawings remain per symbol/timeframe as before; no cross-layout sync. Legacy drawings migrate against currently loaded candles; original historical timestamp cannot be recovered if old logical indexing already shifted. 
- Candlesticks, bars, Heikin Ashi (derived display), line, area; raw OHLC remains the calculation source.
- Snapshot includes drawing and SMC SVG layers on supported browsers. Android WebView download behavior requires device testing.
- Existing Binance/Biquote providers, mobile favorites wheels and D1 default retained. Provider-prefixed symbol queries are normalized; upstream availability is not guaranteed.
## Limits
This is an independent first drawing studio release, not parity with all TradingView tools. No harmonic/Elliott/Gann library, native broker execution, cloud layouts/sync, fully compatible Pine runtime, economic calendar or community/network features were added. User-specific touch, WebView and provider behavior need physical-device verification.
