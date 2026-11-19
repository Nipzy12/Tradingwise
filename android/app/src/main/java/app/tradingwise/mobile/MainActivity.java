package app.tradingwise.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.*;
import android.widget.*;

public final class MainActivity extends Activity {
    private static final String HOME = "https://tradingwise.vercel.app/";
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView errorText;
    private boolean failed;
    private static final int BG = Color.rgb(17, 20, 27);

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams bar = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        root.addView(progress, bar);

        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        errorPanel.setBackgroundColor(BG);
        errorText = new TextView(this);
        errorText.setTextColor(Color.WHITE);
        errorText.setTextSize(17);
        errorText.setGravity(Gravity.CENTER);
        errorPanel.addView(errorText, new LinearLayout.LayoutParams(-1, -2));
        Button retry = new Button(this);
        retry.setText("Coba lagi");
        retry.setOnClickListener(v -> loadHome());
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportMultipleWindows(false);
        if (android.os.Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value < 100 && !failed ? View.VISIBLE : View.GONE);
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                return route(request.getUrl());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                failed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) fail("Tradingwise tidak dapat dimuat. Periksa koneksi internet.");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) {
                if (request.isForMainFrame() && error.getStatusCode() >= 400) fail("Server Tradingwise tidak tersedia (" + error.getStatusCode() + ").");
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                fail("Koneksi HTTPS tidak aman. Periksa jaringan atau waktu perangkat.");
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                web = null;
                recreate();
                return true;
            }
        });
        if (saved == null || web.restoreState(saved) == null) loadHome();
    }

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + .5f); }
    private void loadHome() {
        if (web == null) return;
        failed = false;
        errorPanel.setVisibility(View.GONE);
        web.loadUrl(HOME);
    }
    private boolean route(Uri uri) {
        if ("https".equalsIgnoreCase(uri.getScheme()) &&
            "tradingwise.vercel.app".equalsIgnoreCase(uri.getHost()) &&
            (uri.getPort() == -1 || uri.getPort() == 443)) return false;
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (ActivityNotFoundException ignored) { Toast.makeText(this, "Browser tidak tersedia.", Toast.LENGTH_SHORT).show(); }
        }
        return true;
    }
    private void fail(String message) {
        failed = true;
        progress.setVisibility(View.GONE);
        errorText.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }
    @Override public void onBackPressed() {
        if (failed) { loadHome(); return; }
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        new AlertDialog.Builder(this).setMessage("Tutup Tradingwise?")
            .setNegativeButton("Batal", null)
            .setPositiveButton("Tutup", (d, w) -> finish()).show();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() {
        if (web != null) {
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.stopLoading(); web.destroy(); web = null;
        }
        super.onDestroy();
    }
}
