# Tradingwise cTrader Open API (read-only OAuth)

This integration adds account-scoped broker symbols and historic candles to Tradingwise. It does **not** place orders or execute broker trades.

## Deployed components
- Cloudflare Worker: `tradingwise-ctrader.nexoraz.workers.dev`
- Cloudflare D1: `tradingwise-ctrader-sessions` (isolated from SMC alert database)
- Vercel same-origin proxy: `/api/ctrader/:path*` to the Worker
- cTrader OAuth callback: **`https://tradingwise.vercel.app/api/ctrader/oauth/callback`**
- UI: Symbol Search → Provider **cTrader (OAuth)** → Connect cTrader (read-only)

## REQUIRED ACTIONS BEFORE LOGIN WORKS
The source and database have been deployed. Connected account access stays disabled until:
1. In cTrader Open API Portal → Applications → Lumavun → Edit, register the **exact OAuth redirect URI** above and save.
2. In Cloudflare Dashboard → Workers → `tradingwise-ctrader` → Settings → Variables and Secrets, add 4 **encrypted Secrets**:
   - `CTRADER_CLIENT_ID` : Client ID from your cTrader app
   - `CTRADER_CLIENT_SECRET` : current, **rotated** Client Secret from your cTrader app
   - `CTRADER_SESSION_KEY` : generated 32-byte base64 AES-GCM key (e.g. from `openssl rand -base64 32`)
   - `CTRADER_REDIRECT_URI` : `https://tradingwise.vercel.app/api/ctrader/oauth/callback`
3. After deploying Secrets, open Tradingwise and grant access in cTrader's consent screen; use the **Account info** (`accounts`) scope, not `trading`.
4. Select your broker account before picking its symbols. Available symbols vary by broker and account.

No access tokens, refresh tokens, or Client Secret must ever be committed to GitHub, saved in browser localStorage or sent in chat. **Rotate the Client Secret shared previously in chat** before production and configure only the new one.

## Authentication and privacy
- OAuth code exchange happens only in the Cloudflare Worker.
- A CSRF `state` and HttpOnly/Secure/SameSite=Lax cookies are required for callback and session binding.
- Access and refresh tokens are AES-GCM encrypted in D1, using `CTRADER_SESSION_KEY` as a Cloudflare Secret. Only SHA-256 hash of the random session cookie is a database key.
- Broker symbols and OHLC are scoped to authorized accounts; the Worker validates account ID and symbol ID for every query.
- Account owner can disconnect via POST `/api/ctrader/logout`.
- OAuth requires the provider to echo the `state` parameter. If cTrader's authorization service does not support it, this adapter intentionally rejects the callback rather than disabling CSRF validation. Verify against the live portal.
- Requests to the raw cTrader Open API JSON WebSocket on port 5036 still require verification from the Workers runtime before marking the broker connection operational.

## Data and limits
- Historical trendbars are normalized to OHLC using cTrader's 1/100000 price units and relative delta convention.
- Supported: 1m,3m,5m,15m,30m,1h,4h,1d,1w. 2h isn't natively supported.
- cTrader chart currently uses **60-second REST refresh**, not a full streaming browser WebSocket. Binance/Biquote existing streams are unaffected.
- This is a test/MVP connector: production rate limits, token refresh, mobile OAuth, broker permissions and quotas must be checked on live accounts.
- Cloudflare Workers Free and Vercel Hobby plan limits apply. Vercel Hobby is for personal/non-commercial use.

## Public status
`GET https://tradingwise-ctrader.nexoraz.workers.dev/api/ctrader/health`
returns `configured=false` until all four Secrets are installed. This response contains no credentials.

## Sources
- https://help.ctrader.com/open-api/account-authentication/
- https://help.ctrader.com/open-api/sending-receiving-json/
- https://help.ctrader.com/open-api/model-messages/
- https://help.ctrader.com/open-api/symbol-data/
