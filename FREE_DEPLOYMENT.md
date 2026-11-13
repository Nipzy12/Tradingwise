# Tradingwise free hosting (November 2026)

## Current architecture
- **GitHub**: repository Nipzy12/Tradingwise (main plus reviewed feature branches)
- **Vercel Hobby**: static frontend only (personal/non-commercial use); build: `node scripts/build-static.mjs`
- **Cloudflare Workers Free**: public, read-only market gateway `https://tradingwise-market.nexoraz.workers.dev`; REST Binance Spot + Biquote, streaming proxy for open chart tabs
- **Local Node.js backend**: full charting, persistent JSON SMC alert rules and outbound signed webhooks, requiring an always-running host and durable disk

## What is free and what is not
Cloudflare Worker is stateless in this deployment. **It does not operate persistent indicator alarms or send webhooks while tabs are closed**. Cloudflare request/CPU and upstream-provider limits apply. An open browser tab consumes an upstream socket per subscription; this isn't designed for large-scale public use. The Worker does not accept user-defined provider URLs. Cloudflare Free quotas may reject high load. Vercel Hobby is limited to personal/non-commercial projects; commercial hosting needs a compatible plan or a different permitted host.

## Secrets
Never commit `.env`, admin tokens, API keys, webhook HMAC secrets or private addresses. Node alert functionality must run behind an authenticated HTTPS deployment with persistent storage; see WEBHOOK.md. Do not expose Node alert management endpoints on the public internet without authentication and access controls.

## Running
`npm test` and `npm start` to use the Node implementation; `node scripts/build-static.mjs` builds the static frontend. The static frontend uses Cloudflare APIs automatically on a `*.vercel.app` hostname, otherwise expects same-origin Node backend. The Pine Script v6 file is preserved, but the app's JavaScript SMC reimplementation is **not** a full Pine interpreter.

## Caveats
Market data is never replaced with synthetic candles silently; unsuccessful upstream endpoints show errors. Cloudflare Worker WebSocket outbound behavior and external Binance/Biquote accessibility need live deployment verification. No broker order execution, and no always-on free promise. Avoid unauthorized copying of TradingView proprietary features or trade dress; project is an independent chart application.
