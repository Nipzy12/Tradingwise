# LUMAVUN / Tradingwise Server-side Indicator Alerts (v0.4)

## 1. Configure

Node.js 22+. Public HTTPS is required for a production webhook destination. **No real trades are sent**: this sends alert JSON to your endpoint.

Create **private deployment environment variables** (do not commit `.env`):

```dotenv
ALERT_ADMIN_TOKEN=<long random admin token>
ALERT_WEBHOOK_URL=https://your-webhook-host.example/alerts
ALERT_WEBHOOK_SECRET=<different long random HMAC key>
ALERT_STORE_PATH=./data/alerts.json
```

Generate two independent tokens with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. No `dotenv` library is bundled; set environment variables through your operating system/deployment dashboard. The file `.env.example` is **documentation only**. For local terminal usage, export variables before `npm start`; never store sensitive values in screenshots or public repositories.

**Persistent storage:** On cloud hosts, attach a durable volume to `ALERT_STORE_PATH` or rules and delivery queues disappear when the container is replaced. One server instance only; this JSON store is not a multi-process database.

### 2. UI

Open the chart on your backend server, choose symbol & timeframe, and open Alerts → New → **SMC Webhook · Server**. Select signal events and create. A dialog will request the server admin token, which is held in `sessionStorage` for that tab only. The backend needs to keep running and maintain upstream market subscriptions even when the browser closes.

Seven event types:

- `SMC_ZONE_INVALIDATED`
- `SMC_NEW_BUY_PLAN`, `SMC_NEW_SELL_PLAN`
- `SMC_ENTRY_BUY`, `SMC_ENTRY_SELL`
- `SMC_TAKE_PROFIT`, `SMC_STOP_LOSS`

The SMC calculations run in the JavaScript reimplementation, **not** the original TradingView/Pine compiler. Confirm settings and signals against your own tested strategy before relying on them.

### 3. REST API (all endpoints require `Authorization: Bearer $ALERT_ADMIN_TOKEN`)

```bash
curl -H "Authorization: Bearer $ALERT_ADMIN_TOKEN" http://localhost:8000/api/alerts/status
curl -H "Authorization: Bearer $ALERT_ADMIN_TOKEN" http://localhost:8000/api/alerts/rules

curl -X POST http://localhost:8000/api/alerts/rules \
  -H "Authorization: Bearer $ALERT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"BINANCE:BTCUSDT","interval":"5m","types":["SMC_ENTRY_BUY","SMC_ENTRY_SELL"],"settings":{"htfMode":"Off"},"active":true}'

curl -H "Authorization: Bearer $ALERT_ADMIN_TOKEN" http://localhost:8000/api/alerts/events
curl -X POST -H "Authorization: Bearer $ALERT_ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}' http://localhost:8000/api/alerts/test
# DELETE /api/alerts/rules/<uuid>
```

Rules validate symbols against upstream provider catalogs and timeframes against provider capabilities. 100 rules maximum. A new rule starts at the latest REST candle (no replay of old alerts).

### 4. Delivery protocol

```json
{
  "id": "e7be...",
  "event": "SMC_ENTRY_BUY",
  "ruleId": "uuid",
  "indicator": "SMC Entry Models PRO v5 (JavaScript adaptation)",
  "provider": "BINANCE",
  "symbol": "BTCUSDT",
  "marketId": "BINANCE:BTCUSDT",
  "timeframe": "5m",
  "candleOpenTime": "2026-11-13T12:00:00.000Z",
  "timestamp": "2026-11-13T12:05:00.000Z",
  "confirmed": true,
  "model": "M1 SWEEP+OB",
  "side": "BUY",
  "entry": 95000,
  "sl": 94900,
  "tp": 95200,
  "price": 95000,
  "candle": {"open":94950,"high":95050,"low":94900,"close":95000,"volume":100}
}
```

Values above are **illustrative only**, not a real trade. `entry`, `sl`, or `tp` may be null depending on the signal (e.g. invalidated zone).

HTTP request: `POST`, `Content-Type: application/json`, `X-Lumavun-Event-Id` and `Idempotency-Key` both equal event `id`. `X-Lumavun-Signature-256: sha256=<hex-hmac>` signs the exact raw JSON request body using `ALERT_WEBHOOK_SECRET`. Your receiver should validate the HMAC with constant-time comparison **before** trusting any alert and deduplicate the `Idempotency-Key`. Never treat unauthenticated webhook JSON as authority to place live orders.

Outbox persists events, attempts delivery immediately, retries failures with exponential backoff (maximum five tries), preserves final failed status for diagnostics. This is **at least once** delivery, not exactly once: if process crashes after a successful HTTP response and before persistence, receivers can see a duplicate. The receiver should return 2xx only after accepting the event. Redirects are not followed. Upstream connectivity and hosting network may disrupt timing.

### 5. Important behavior and limitations

- Binance: process only websocket Kline `isOpen=false` bars.
- Biquote: aggregate SignalR ticks into the selected timeframe. A prior candle is closed only after a tick arrives in the following candle bucket. On weekends or thin markets, alerts can be delayed until the next active tick.
- Data is live only when real providers are reachable; tests use synthetic fixtures strictly for tests.
- On **fresh start or restart**, baseline is the latest REST candle; this intentionally skips historical alerts while server was offline. No attempt to backfill missed alerts yet.
- Pending server alerts remain usable without browser open, but **not without Node backend running**. Container must support outbound Binance/Biquote and the webhook host.
- No alert on arbitrary `alertcondition()` Pine scripts: only the supported SMC JavaScript adapter is integrated.
- Never put the admin token or webhook secret in the repo or browser localStorage. Use HTTPS for the app in production. This implementation expects one trusted admin, not multi-tenant user accounts.

## 6. Test

`npm test` tests API authentication, SMC close-only triggering, deterministic IDs, delivery HMAC, retries, persistence, plus earlier market data and SMC tests. Network integration uses mocks; **not** a live-provider guarantee.
