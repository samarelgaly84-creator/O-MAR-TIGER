package com.tiger.connect

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class IncomingCallActivity : AppCompatActivity() {

    private var ringtone: Ringtone? = null
    private var activeCallId: String = ""

    private val cancelReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val targetId = intent?.getStringExtra("call_id") ?: ""
            if (targetId.isEmpty() || targetId == activeCallId) {
                stopAlertMedia()
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable lock-screen display across Android API levels (API 24-35)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        setContentView(R.layout.activity_incoming_call)

        activeCallId = intent.getStringExtra("call_id") ?: ""
        val callerName = intent.getStringExtra("caller_name") ?: "TIGER User"
        val callerAvatar = intent.getStringExtra("caller_avatar") ?: ""
        val isVideo = intent.getBooleanExtra("is_video", false)

        findViewById<TextView>(R.id.tvCallerName).text = callerName
        findViewById<TextView>(R.id.tvCallType).text =
            if (isVideo) "مكالمة فيديو واردة..." else "مكالمة صوتية واردة..."

        if (callerAvatar.startsWith("http")) {
            val avatarView = findViewById<ImageView>(R.id.ivCallerAvatar)
            Thread {
                try {
                    val conn = URL(callerAvatar).openConnection() as HttpURLConnection
                    conn.connectTimeout = 4000
                    conn.readTimeout = 4000
                    val bmp = BitmapFactory.decodeStream(conn.inputStream)
                    if (bmp != null) {
                        runOnUiThread { avatarView.setImageBitmap(bmp) }
                    }
                } catch (_: Throwable) {
                    // Fallback icon stays displayed
                }
            }.start()
        }

        ContextCompat.registerReceiver(
            this,
            cancelReceiver,
            IntentFilter(TigerFirebaseMessagingService.ACTION_CANCEL_CALL_UI),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        startAlertMedia()

        findViewById<Button>(R.id.btnAcceptCall).setOnClickListener {
            respond("answer")
        }
        findViewById<Button>(R.id.btnDeclineCall).setOnClickListener {
            respond("decline")
        }
    }

    private fun respond(action: String) {
        stopAlertMedia()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(activeCallId.hashCode())

        val actionIntent = Intent(this, CallNotificationActionReceiver::class.java).apply {
            this.action = CallNotificationActionReceiver.ACTION_CALL_RESPOND
            putExtra("call_id", activeCallId)
            putExtra("call_action", action)
        }
        sendBroadcast(actionIntent)
        finish()
    }

    private fun startAlertMedia() {
        val prefs = getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
        val raw = prefs.getString("sound_settings_json", null)
        var silent = false
        var vibrate = true
        var callSound = true
        if (!raw.isNullOrBlank()) {
            try {
                val obj = JSONObject(raw)
                silent = obj.optBoolean("silentMode", false)
                vibrate = obj.optBoolean("vibrationEnabled", true)
                callSound = obj.optBoolean("callSoundEnabled", true)
            } catch (_: Throwable) {
            }
        }
        if (silent) return

        if (callSound) {
            try {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                val rt = RingtoneManager.getRingtone(applicationContext, uri)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    rt.isLooping = true
                    rt.audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                }
                rt.play()
                ringtone = rt
            } catch (_: Throwable) {
            }
        }

        if (vibrate) {
            val pattern = longArrayOf(0, 500, 300, 500, 300)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    v.vibrate(pattern, 0)
                }
            }
        }
    }

    private fun stopAlertMedia() {
        try {
            ringtone?.stop()
        } catch (_: Throwable) {
        }
        ringtone = null
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator.cancel()
            } else {
                @Suppress("DEPRECATION")
                (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).cancel()
            }
        } catch (_: Throwable) {
        }
    }

    override fun onDestroy() {
        stopAlertMedia()
        try {
            unregisterReceiver(cancelReceiver)
        } catch (_: Throwable) {
        }
        super.onDestroy()
    }
}
