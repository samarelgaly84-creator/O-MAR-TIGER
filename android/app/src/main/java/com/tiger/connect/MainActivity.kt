package com.tiger.connect

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var fcmTokenCached: String = ""
    private var pageLoaded = false
    private var pendingShareJson: String? = null
    private var pendingCallActionJson: String? = null
    private var pendingOpenUrlJson: String? = null
    private var callActiveState = false

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* Permissions applied cleanly when needed */ }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { res ->
        val uris = WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data)
        fileUploadCallback?.onReceiveValue(uris)
        fileUploadCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        requestNecessaryRuntimePermissions()
        fetchAndSyncFcmToken()

        handleIncomingIntent(intent)

        val baseUrl = BuildConfig.TIGER_SERVER_URL
        webView.loadUrl(baseUrl)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onPause() {
        super.onPause()
        if (callActiveState) {
            webView.resumeTimers()
        }
    }

    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        webView.addJavascriptInterface(TigerNativeBridge(), "TigerAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith(BuildConfig.TIGER_SERVER_URL)) {
                    return false
                }
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pageLoaded = true
                flushPendingDispatches()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                runOnUiThread {
                    request.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                val pickerIntent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                fileChooserLauncher.launch(pickerIntent)
                return true
            }
        }
    }

    private fun requestNecessaryRuntimePermissions() {
        val needed = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionsLauncher.launch(missing.toTypedArray())
        }
    }

    private fun fetchAndSyncFcmToken() {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result ?: return@addOnCompleteListener
                    fcmTokenCached = token
                    if (pageLoaded) {
                        val js = "window.dispatchEvent(new CustomEvent('tiger-fcm-token', { detail: ${
                            JSONObject().put("token", token)
                        } }));"
                        webView.post { webView.evaluateJavascript(js, null) }
                    }
                }
            }
        } catch (_: Throwable) {
            // Firebase google-services.json not yet configured in local APK build
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return

        val callAction = intent.getStringExtra("call_action")
        val callId = intent.getStringExtra("call_id")
        if (!callAction.isNullOrBlank() && !callId.isNullOrBlank()) {
            val payload = JSONObject()
                .put("action", callAction)
                .put("callId", callId)
                .toString()
            pendingCallActionJson = payload
            if (pageLoaded) flushPendingDispatches()
        }

        val openUrl = intent.getStringExtra("open_url")
        if (!openUrl.isNullOrBlank()) {
            pendingOpenUrlJson = JSONObject().put("url", openUrl).toString()
            if (pageLoaded) flushPendingDispatches()
        }

        val action = intent.action
        if (action == Intent.ACTION_SEND || action == Intent.ACTION_SEND_MULTIPLE) {
            Thread {
                val payload = buildSharePayloadJson(intent)
                runOnUiThread {
                    pendingShareJson = payload
                    if (pageLoaded) flushPendingDispatches()
                }
            }.start()
        }
    }

    private fun flushPendingDispatches() {
        pendingShareJson?.let { json ->
            pendingShareJson = null
            val js = """
                (function(){
                  var detail = $json;
                  window.__TIGER_PENDING_NATIVE_SHARE__ = detail;
                  window.dispatchEvent(new CustomEvent('tiger-native-share', { detail: detail }));
                })();
            """.trimIndent()
            webView.evaluateJavascript(js, null)
        }

        pendingCallActionJson?.let { json ->
            pendingCallActionJson = null
            val js = "window.dispatchEvent(new CustomEvent('tiger-native-call-action', { detail: $json }));"
            webView.evaluateJavascript(js, null)
        }

        pendingOpenUrlJson?.let { json ->
            pendingOpenUrlJson = null
            val js = "window.dispatchEvent(new CustomEvent('tiger-navigate', { detail: $json }));"
            webView.evaluateJavascript(js, null)
        }
    }

    private fun buildSharePayloadJson(intent: Intent): String {
        val root = JSONObject()
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: ""
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
        root.put("title", subject)
        root.put("text", text)
        root.put("url", if (text.startsWith("http://") || text.startsWith("https://")) text else "")

        val uris = mutableListOf<Uri>()
        if (intent.action == Intent.ACTION_SEND) {
            IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)?.let {
                uris.add(it)
            }
        } else if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
            IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)?.let {
                uris.addAll(it)
            }
        }

        val filesArray = JSONArray()
        val maxBytesPerFile = 18 * 1024 * 1024 // 18 MB safe IPC ceiling per file
        for (uri in uris.take(10)) {
            val item = readUriAsBase64Json(uri, maxBytesPerFile)
            if (item != null) filesArray.put(item)
        }
        root.put("files", filesArray)
        return root.toString()
    }

    private fun readUriAsBase64Json(uri: Uri, maxBytes: Int): JSONObject? {
        return try {
            val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
            var fileName = "shared_${System.currentTimeMillis()}"
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) fileName = cursor.getString(idx) ?: fileName
                }
            }

            contentResolver.openInputStream(uri)?.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(16384)
                var total = 0
                while (true) {
                    val read = input.read(buf)
                    if (read <= 0) break
                    total += read
                    if (total > maxBytes) return null
                    out.write(buf, 0, read)
                }
                val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                JSONObject()
                    .put("name", fileName)
                    .put("mimeType", mimeType)
                    .put("base64", b64)
            }
        } catch (_: Throwable) {
            null
        }
    }

    inner class TigerNativeBridge {
        @JavascriptInterface
        fun setAuthToken(token: String) {
            getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
                .edit()
                .putString("auth_token", token)
                .apply()
        }

        @JavascriptInterface
        fun getFcmToken(): String = fcmTokenCached

        @JavascriptInterface
        fun setSpeakerphoneOn(enabled: Boolean) {
            runOnUiThread {
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.mode = AudioManager.MODE_IN_COMMUNICATION
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = enabled
            }
        }

        @JavascriptInterface
        fun setCallActive(active: Boolean) {
            callActiveState = active
            runOnUiThread {
                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                if (active) {
                    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    am.mode = AudioManager.MODE_IN_COMMUNICATION
                    @Suppress("DEPRECATION")
                    am.requestAudioFocus(
                        null,
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                    )
                    webView.resumeTimers()
                } else {
                    window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    am.mode = AudioManager.MODE_NORMAL
                    @Suppress("DEPRECATION")
                    am.abandonAudioFocus(null)
                }
            }
        }

        @JavascriptInterface
        fun syncSoundSettings(json: String) {
            getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
                .edit()
                .putString("sound_settings_json", json)
                .apply()
        }

        @JavascriptInterface
        fun showStatusBarNotification(title: String, body: String, tag: String, url: String) {
            val ctx = applicationContext
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId = if (tag.contains("chat")) {
                TigerFirebaseMessagingService.CHANNEL_MESSAGES
            } else {
                TigerFirebaseMessagingService.CHANNEL_GENERAL
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (nm.getNotificationChannel(channelId) == null) {
                    val ch = NotificationChannel(
                        channelId,
                        if (channelId == TigerFirebaseMessagingService.CHANNEL_MESSAGES) "Messages" else "Notifications",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        enableVibration(true)
                    }
                    nm.createNotificationChannel(ch)
                }
            }

            val notifId = tag.ifBlank { "tiger_${System.currentTimeMillis()}" }.hashCode()
            val openIntent = Intent(ctx, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("open_url", url.ifBlank { "/?section=notifications" })
            }
            val openPending = PendingIntent.getActivity(
                ctx,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(ctx, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title.ifBlank { "TIGER CONNECT" })
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(openPending)
                .build()

            nm.notify(notifId, notification)
        }

        @JavascriptInterface
        fun vibrate(ms: Int) {
            val duration = ms.coerceIn(20, 2000).toLong()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(
                    VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    v.vibrate(duration)
                }
            }
        }
    }
}
