# Tradingwise Cloud SMC Alerts (Workers Free + D1)

## Deployment

- Cloudflare Worker: `tradingwise-alerts`, endpoint `https://tradingwise-alerts.nexoraz.workers.dev/api/alerts/health`
- Database: `tradingwise-alerts-free` (D1, APAC). Schema: `migrations/0001_cloud_alerts.sql`
- Schedule: `*/5 * * * *` (every five minutes UTC, not precise to the second)
- Website: `https://tradingwise.vercel.app/`, SMC alert UI under **Alert -> SMC Webhook · Server**

## Admin access

Set Cloudflare Worker secret `ADMIN_TOKEN` to a cryptographically random string with at least 32 characters. Never put it in GitHub, Vercel environment variables exposed to the browser, or query strings. When the chart prompts for it, it is kept only in sessionStorage for that browser tab.

When using the Cloudflare Worker directly, pass `Authorization: Bearer <ADMIN_TOKEN>` on every management request. You can GET `/api/alerts/status`, GET/POST `/api/alerts/rules`, DELETE `/api/alerts/rules/{ruleId}`, and GET `/api/alerts/events`. Health is public but contains no token.

Example rule POST body:

```json
{"symbol":"BIQUOTE:XAUUSD","interval":"5m","types":["SMC_ENTRY_BUY","SMC_ENTRY_SELL","SMC_TAKE_PROFIT","SMC_STOP_LOSS"],"settings":{},"active":true}
```

## Webhook delivery

Set Cloudflare Worker secret/variable `WEBHOOK_URL` to a publicly accessible HTTPS endpoint that **you control**, and secret `WEBHOOK_SECRET` to a random value at least 16 characters long. They must not be placed in GitHub. Event POST contains `Idempotency-Key`, `X-Lumavun-Event-Id`, and `X-Lumavun-Signature-256: sha256=<hex HMAC-SHA256>` over the *raw JSON request body*. Verify the signature and ignore duplicate event IDs at the receiver. Delivery retries up to five times; events are stored in D1 even when `WEBHOOK_URL` has not yet been configured.

## Free-tier and functional limits

- **At most 3 scheduled active/inactive rules total** per account. Remove old rules to make space.
- **BIQUOTE** only (not Binance), because Binance blocked the Cloudflare Worker egress with HTTP 403 in live tests. The browser's direct Binance live feed is separate and works when the user's network permits it.
- Timeframes **5m, 15m, 30m, 1h, 4h, 1d**; no 1m SMC cron on this free tier.
- The first cron invocation **baselines** the latest closed candle. It will not send historical signals; future closed candles can generate events.
- Poll runs at five-minute intervals. Delivery has bounded retries, not strict real-time guarantees. Missed provider candles may skip older signals (the latest closed candle is considered).
- Uses a custom JavaScript interpretation of SMC Entry Models PRO v5, **not the Pine Script v6 runtime**; numerical output may differ from TradingView.
- Workers Free offers 10ms CPU per Cron invocation and 100,000 requests/day. Three SMC computations may still exceed CPU at times. D1 free row limits are enforced; if exceeded, alert processing stops until reset. Monitor Cloudflare metrics.
- No broker order routing. Alerts must not be treated as guaranteed or investment advice.

## Safety

The admin API has no CORS access except for `https://tradingwise.vercel.app`, uses Bearer authorization, and refuses management when `ADMIN_TOKEN` is unset. All webhook destinations are fixed on the server, never supplied by users. Do not include secrets in screenshots, browser logs, or repository files.

Run unit tests with `npm test`; Node v22+ includes the experimental `node:sqlite` used only for local tests.
