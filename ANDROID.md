# Tradingwise Android preview 0.1.0

Native Android WebView shell for https://tradingwise.vercel.app/. It uses the deployed web workspace and its existing Binance browser API / Biquote Worker gateway, rather than duplicating market-data code. cTrader remains optional and is not required. Internet and an updated Android System WebView are required; Android 7.0+ (API 24). App ID: app.tradingwise.mobile.

## Download
Open Actions → Tradingwise Android APK → successful run → Artifacts → Tradingwise-Android-APK. Extract the ZIP and install the APK. The main branch workflow additionally publishes a prerelease with the raw APK and checksum when release permissions are available. Allow installation from the browser or file manager in Android settings. This is a debug-signed preview, not Play Store signing; separate runners may generate different debug certificates, so uninstall an older preview if Android refuses updating and back up settings first.

## Build locally
JDK 17, Android SDK 35, Gradle 8.9. From android/: gradle :app:assembleDebug :app:lintDebug. The APK is under app/build/outputs/apk/debug/. No broker credentials are included.

The shell allows HTTPS only, keeps JavaScript and DOM storage enabled, rejects insecure TLS, disallows file/content access, opens external HTTPS links in the browser, and includes a connection retry panel. No JavaScript/native interface is exposed. Web features such as browser-specific exports and authentication may differ from Chrome; the debug APK has not been device-tested until a real installation test is performed. The existing web app deployment is unchanged.
