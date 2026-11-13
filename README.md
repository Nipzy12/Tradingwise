# Tradingwise / LUMAVUN Supercharts v0.4 · Binance + Biquote Market Gateway

Charting web app dengan Node backend, searchable full symbol catalogs, REST historical candles, and upstream WebSockets for real-time updates.

## Jalankan

**Butuh Node.js 22 atau lebih baru**, koneksi internet keluar ke domain provider, dan browser terbaru. Tidak perlu `npm install` karena paket ini memakai Node built-ins.

```bash
cd lumavun-supercharts
npm start
# atau: node server/index.mjs
```

Buka **http://localhost:8000**. Boleh menjalankan `start-windows.bat` (Windows) atau `./start-linux-mac.sh` (Linux/Mac). Default binding `127.0.0.1` untuk keamanan; deploy dengan `HOST=0.0.0.0 PORT=8000 node server/index.mjs` di platform yang mendukung Node WebSocket server.

**Penting:** Browser harus membuka situs melalui backend Node, bukan `index.html` langsung, `python -m http.server`, GitHub Pages, atau satu file standalone, karena rute `/api/market/*` dan `/ws/market` wajib ada. Proxy hosting harus mendukung WebSocket upgrade. Pakai HTTPS/WSS di deployment publik.

## Provider dan autentikasi

| Provider | REST | Live WebSocket | Katalog | Timeframe |
|---|---|---|---|---|
| Binance **Spot** | `https://data-api.binance.vision/api/v3/exchangeInfo` dan `/klines` | `wss://data-stream.binance.vision:443/ws/{symbol}@kline_{interval}` | Seluruh simbol di `exchangeInfo`, termasuk status non-TRADING | 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, 1w |
| Biquote | `https://biquote.io/api/symbols`, `/api/{symbol}/ohlc`, `/api/latest` | `https://biquote.io/hubs/tick` lewat SignalR JSON/WS (`Subscribe`, `ReceiveTick`) | Seluruh simbol di `/api/symbols`, termasuk yang tidak sedang memiliki quote | 1m, 5m, 15m, 30m, 1h, 4h, 1d; 1w agregasi 1d |

**Tidak memakai API key** untuk market data publik. Backend menggunakan katalog dinamis, bukan hardcode sebagian simbol. IDs dipisah dengan prefix `BINANCE:BTCUSDT` vs `BIQUOTE:BTCUSD` supaya tidak berbenturan, termasuk simbol yang ejaannya sama di provider berbeda. Katalog dicache 5 menit dan pencarian melalui query server + pagination.

Biquote bukan feed orderbook Binance. Untuk instrumen FX/CFD, perhitungan harga candle baru dari tick menggunakan **mid** (rata-rata bid/ask) dan REST OHLC; volume Biquote FX tidak boleh dianggap exchange-traded volume. Saat `marketState=closed` atau `stale=true`, tick tidak mengubah candlestick, dan UI menandai status tertutup/stale. Candle 1w Biquote diagregasi di backend dari 1d menggunakan minggu yang mulai Senin UTC dan bisa kurang dari jumlah bar diminta karena limit data provider.

## Gateway API (same origin)

- `GET /api/market/health` menunjukkan koneksi WebSocket dan error katalog cache.
- `GET /api/market/symbols?provider=ALL&q=USD&limit=70&offset=0` mengembalikan `{items,total,counts,errors}`. `provider` bisa `ALL`, `BINANCE`, atau `BIQUOTE`.
- `GET /api/market/candles?symbol=BIQUOTE:XAUUSD&interval=1h&limit=500` mengembalikan `{candles,source,aggregated,...}`.
- `GET /api/market/tickers?symbols=BINANCE:BTCUSDT,BIQUOTE:XAUUSD` returns normalized price/change/freshness.
- WebSocket `/ws/market` browser sends `{"action":"subscribe","symbol":"BINANCE:BTCUSDT","interval":"1m"}` (one active chart subscription per session). Server sends `hello`, `status`, and `candle` (Binance) or `tick` (Biquote); Biquote tick is aggregated in the browser against the initial OHLC candle. Send `{"action":"unsubscribe"}` to release.

Upstream streams are shared across same instrument/subscription users. They reconnect with exponential backoff and resubscribe after reconnection. Backend prevents arbitrary upstream URL proxying: symbols are validated against provider catalogs. No market price is synthesized if provider fails; app shows error. REST is refreshed on symbol/timeframe change or page reload; for a long disconnect, refresh chart to restore missed candles.

## Server-side SMC alerts and webhook (v0.4)

**New:** Alerts → Buat alert → **SMC Webhook · Server** creates SMC signal rules on the Node gateway. Alerts are checked at confirmed candle closes, stored in `data/alerts.json`, and delivered via HTTPS POST with optional HMAC signature and persistent retry queue. Includes seven SMC event types, API-protected rule management and test delivery. Browser local price alerts still exist separately.

Set `ALERT_ADMIN_TOKEN`, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_SECRET`, and persistent `ALERT_STORE_PATH` in your **server environment**, then start the backend. See [WEBHOOK.md](WEBHOOK.md) for setup, authentication, event payload, and limitations. No Pine v6 runtime equivalence and no automatic brokerage orders.

## Config (optional)

Variables are **server-side only**: `BINANCE_REST`, `BINANCE_WS`, `BIQUOTE_REST`, `BIQUOTE_HUB`, `HOST`, `PORT`. The defaults use official public read-only endpoints above. No exchange trading/portfolio key is needed.

## Pengujian

```bash
npm test
```

Unit + mocked gateway contract tests cover symbol lists, errors, OHLC, weekly aggregation, stale ticks, Binance WS, SignalR handshake, backend API, and same-origin browser WS framing. **Mock tests are not live-provider connectivity tests.** For a real deployment, ensure outbound DNS and network access for Binance and Biquote, then check `/api/market/health` and browser status badge `STREAM`.

## Fitur charting lama tetap ada

Candlesticks, drawing tools, price alerts while open, local paper trade, indicators EMA/SMA/RSI/MACD/VWAP/Bollinger, SMC Entry Models PRO v5 with 57 settings and original `.pine` source, Pine subset editor, local EMA backtester, bar replay, workspace JSON import/export. **Pine Script v6 original isn't executed**: SMC runs as a JavaScript port. Backtest is not exchange execution. Local price alert and paper trading remain browser-only; SMC webhook alerts are server-side after configuration.

### Market-data limitations

- Catalog is full as the **provider API returns**, not a promise every listed instrument trades or quotes continuously.
- Binance integration is **Spot only** (not Futures / perpetual / delivery contracts). Futures needs another adapter and catalog.
- Binance and Biquote prices may differ because their feeds/asset types differ. Market closed/stale/quoted-within-days are separate from symbol listing.
- An outage results in a clear error, **never fake candles**. No guarantee of uninterrupted quote availability.
- Outbound internet couldn't be accessed from build sandbox; mocked provider integration and browser functionality are verified locally. Verify the real providers in the deployment network before making trading decisions.

## License

Original app code MIT; Lightweight Charts™ Apache 2.0 attribution required, see `THIRD_PARTY_NOTICES.md`. This project is not affiliated with TradingView, Binance, or Biquote. Confirm vendor terms before public commercial redistributions.
