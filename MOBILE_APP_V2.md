# Mobile app shell v2

References: user-supplied Android TradingView screenshots, official TradingView mobile page and Android Analysis Hub help. TinyFish opened the official site but could not emulate a phone or execute an APK. This is an independently implemented UI, not a native TradingView clone.

- Chart tab retains vertical favorite pair/timeframes, horizontal actions, symbol quote currency, drawing engine, indicators and live provider connections.
- Watchlist becomes full page with filters and stable keyed rows; tap symbol to open chart.
- Explore has provider catalog, search, favorites, pagination and add-to-watchlist. No fabricated quotes or social feed.
- Analysis Hub offers existing functional modules and a drawing favorites strip. Mobile dialogs become bottom sheets.
- Menu has workspace, analysis, and preferences. Alert stays a functional tab instead of a fake community feature.
- Desktop remains unchanged except shared watchlist DOM stability and safer dialog handlers. Native APK remains a hosted WebView; no binary change needed. Real Android touch and device QA are still required.
