package uz.shoxrux.ruschaqadam;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Ruscha Qadam — Android ilova.
 * Ilovaning o'zi (darslar, lug'at, o'yinlar) assets/index.html faylida.
 * Bu klass uni to'liq ekranda ochadi va telefonning ovoz tizimini (TTS) ulaydi.
 * made by shoxrux
 */
public class MainActivity extends Activity implements TextToSpeech.OnInitListener {

    private WebView web;
    private TextToSpeech tts;
    /** 0 — tayyorlanmoqda, 1 — ruscha ovoz bor, 2 — ruscha ovoz yo'q, 3 — ovoz tizimi ishlamadi */
    private volatile int ttsStatus = 0;

    /* ---- Nutqni tanish (talaffuzni tekshirish) ---- */
    private static final int REQ_MIC = 4242;
    private SpeechRecognizer recognizer;
    private String pendingListenId = null;
    private long lastLevelAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");

        try {
            tts = new TextToSpeech(this, this);
        } catch (Exception e) {
            ttsStatus = 3;
        }

        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) {
            ttsStatus = 3;
            return;
        }
        int r = tts.setLanguage(new Locale("ru", "RU"));
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            r = tts.setLanguage(new Locale("ru"));
        }
        ttsStatus = (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) ? 2 : 1;

        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { }
            @Override public void onDone(String utteranceId) { notifyDone(utteranceId); }
            @Override public void onError(String utteranceId) { notifyDone(utteranceId); }
        });
    }

    /** JavaScript tomoniga "gap tugadi" deb xabar berish */
    private void notifyDone(final String id) {
        if (id == null) return;
        final String safeId = id.replaceAll("[^A-Za-z0-9_]", "");
        runOnUiThread(new Runnable() {
            @Override public void run() {
                if (web != null) {
                    web.evaluateJavascript("window.__ttsDone && window.__ttsDone('" + safeId + "')", null);
                }
            }
        });
    }

    /** index.html dan chaqiriladigan funksiyalar (window.AndroidTTS) */
    private class TtsBridge {
        @JavascriptInterface
        public int status() {
            return ttsStatus;
        }

        @JavascriptInterface
        public void speak(String text, float rate, float pitch, String id) {
            if (tts == null || ttsStatus != 1) {
                notifyDone(id);
                return;
            }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle params = new Bundle();
            int res = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id);
            if (res != TextToSpeech.SUCCESS) notifyDone(id);
        }

        @JavascriptInterface
        public void stop() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public void installVoice() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent i = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                        startActivity(i);
                    } catch (Exception e) {
                        openTtsSettingsNow();
                    }
                }
            });
        }

        /** Telefonda nutqni tanish xizmati bormi */
        @JavascriptInterface
        public boolean sttAvailable() {
            try {
                return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
            } catch (Exception e) {
                return false;
            }
        }

        /** Mikrofon ruxsati berilganmi */
        @JavascriptInterface
        public boolean micGranted() {
            return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        }

        /** Tinglashni boshlash (natija window.__sttResult ga keladi) */
        @JavascriptInterface
        public void listen(final String id) {
            runOnUiThread(new Runnable() {
                @Override public void run() { startListening(id); }
            });
        }

        /** Tinglashni to'xtatish */
        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (recognizer != null) {
                        try { recognizer.stopListening(); } catch (Exception ignored) { }
                    }
                }
            });
        }

        /** Ilova sozlamalarini ochish (ruxsatni qo'lda yoqish uchun) */
        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                Uri.fromParts("package", getPackageName(), null));
                        startActivity(i);
                    } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() { openTtsSettingsNow(); }
            });
        }
    }

    /* ===================== NUTQNI TANISH ===================== */

    private void startListening(String id) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingListenId = id;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendSttError(id, 100);
            return;
        }
        if (tts != null) tts.stop();
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
        final String rid = id;
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        } catch (Exception e) {
            sendSttError(rid, 100);
            return;
        }
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) { sendSttState(rid, "ready"); }
            @Override public void onBeginningOfSpeech() { sendSttState(rid, "speech"); }
            @Override public void onRmsChanged(float rmsdB) {
                long now = SystemClock.uptimeMillis();
                if (now - lastLevelAt < 90) return;
                lastLevelAt = now;
                sendJs("window.__sttLevel && window.__sttLevel(" + rmsdB + ")");
            }
            @Override public void onBufferReceived(byte[] buffer) { }
            @Override public void onEndOfSpeech() { sendSttState(rid, "end"); }
            @Override public void onError(int error) { sendSttError(rid, error); }
            @Override public void onResults(Bundle results) {
                ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                float[] conf = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                JSONArray texts = new JSONArray();
                JSONArray scores = new JSONArray();
                if (list != null) {
                    for (int i = 0; i < list.size(); i++) {
                        texts.put(list.get(i));
                        try { scores.put(conf != null && i < conf.length ? (double) conf[i] : -1.0); }
                        catch (Exception ignored) { }
                    }
                }
                sendJs("window.__sttResult && window.__sttResult('" + safeId(rid) + "', " + texts.toString() + ", " + scores.toString() + ")");
            }
            @Override public void onPartialResults(Bundle partialResults) { }
            @Override public void onEvent(int eventType, Bundle params) { }
        });
        Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
        it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ru-RU");
        it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        it.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        it.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        try {
            recognizer.startListening(it);
        } catch (Exception e) {
            sendSttError(rid, 5);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MIC) return;
        String id = pendingListenId;
        pendingListenId = null;
        if (id == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startListening(id);
        } else {
            boolean canAskAgain = shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO);
            sendSttError(id, canAskAgain ? 9 : 99);
        }
    }

    private String safeId(String id) {
        return id == null ? "" : id.replaceAll("[^A-Za-z0-9_]", "");
    }

    private void sendSttState(String id, String st) {
        sendJs("window.__sttState && window.__sttState('" + safeId(id) + "', '" + st + "')");
    }

    private void sendSttError(String id, int code) {
        sendJs("window.__sttError && window.__sttError('" + safeId(id) + "', " + code + ")");
    }

    private void sendJs(final String js) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                if (web != null) web.evaluateJavascript(js, null);
            }
        });
    }

    private void openTtsSettingsNow() {
        try {
            startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
        } catch (Exception e) {
            try {
                startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
            } catch (Exception ignored) { }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Foydalanuvchi ruscha ovozni o'rnatib qaytgan bo'lsa — qayta tekshiramiz
        if (tts != null && ttsStatus == 2) {
            int r = tts.setLanguage(new Locale("ru", "RU"));
            if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) {
                ttsStatus = 1;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__back && window.__back()) ? 'yes' : 'no'", value -> {
            if (value == null || !value.contains("yes")) {
                finish();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (tts != null) tts.stop();
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) { }
        }
    }

    @Override
    protected void onDestroy() {
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
