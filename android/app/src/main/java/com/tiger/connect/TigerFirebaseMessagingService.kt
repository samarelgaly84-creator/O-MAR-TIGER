package com.tiger.connect

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

class TigerFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_CALLS = "tiger_calls_v1"
        const val CHANNEL_MESSAGES = "tiger_messages_v1"
        const val CHANNEL_GENERAL = "tiger_general_v1"
        const val ACTION_CANCEL_CALL_UI = "com.tiger.connect.CANCEL_CALL_UI"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        ensureChannels()

        val data = remoteMessage.data
        val type = data["type"] ?: "notification"
        val title = data["title"] ?: "TIGER CONNECT"
        val body = data["body"] ?: ""
        val callId = data["callId"] ?: ""
        val fromDisplayName = data["fromDisplayName"] ?: "TIGER User"
        val fromAvatarUrl = data["fromAvatarUrl"] ?: ""
        val isVideo = data["video"] == "1"

        val prefs = getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
        val soundPrefs = parseSoundPrefs(prefs.getString("sound_settings_json", null))

        when (type) {
            "call:invite" -> {
                wakeScreenTemporarily()
                showIncomingCallNotification(callId, fromDisplayName, fromAvatarUrl, isVideo, soundPrefs)
            }
            "call:cancelled" -> {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.cancel(callId.hashCode())
                sendBroadcast(Intent(ACTION_CANCEL_CALL_UI).setPackage(packageName).putExtra("call_id", callId))
            }
            "call:missed" -> {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.cancel(callId.hashCode())
                sendBroadcast(Intent(ACTION_CANCEL_CALL_UI).setPackage(packageName).putExtra("call_id", callId))
                showStandardNotification(
                    notifId = ("missed_$callId").hashCode(),
                    channelId = CHANNEL_GENERAL,
                    title = title,
                    body = body,
                    url = "/?section=chat&tab=calls",
                    soundEnabled = !soundPrefs.silentMode && soundPrefs.notificationSoundEnabled,
                    vibrateEnabled = !soundPrefs.silentMode && soundPrefs.vibrationEnabled
                )
            }
            "message" -> {
                showStandardNotification(
                    notifId = (data["tag"] ?: "msg_${System.currentTimeMillis()}").hashCode(),
                    channelId = CHANNEL_MESSAGES,
                    title = title,
                    body = body,
                    url = data["url"] ?: "/?section=chat",
                    soundEnabled = !soundPrefs.silentMode && soundPrefs.messageSoundEnabled,
                    vibrateEnabled = !soundPrefs.silentMode && soundPrefs.vibrationEnabled
                )
            }
            else -> {
                showStandardNotification(
                    notifId = (data["tag"] ?: "gen_${System.currentTimeMillis()}").hashCode(),
                    channelId = CHANNEL_GENERAL,
                    title = title,
                    body = body,
                    url = data["url"] ?: "/?section=notifications",
                    soundEnabled = !soundPrefs.silentMode && soundPrefs.notificationSoundEnabled,
                    vibrateEnabled = !soundPrefs.silentMode && soundPrefs.vibrationEnabled
                )
            }
        }
    }

    private fun showIncomingCallNotification(
        callId: String,
        callerName: String,
        callerAvatar: String,
        isVideo: Boolean,
        soundPrefs: SoundPrefs
    ) {
        val fullScreenIntent = Intent(this, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("caller_name", callerName)
            putExtra("caller_avatar", callerAvatar)
            putExtra("is_video", isVideo)
        }
        val fullScreenPending = PendingIntent.getActivity(
            this,
            callId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val acceptIntent = Intent(this, CallNotificationActionReceiver::class.java).apply {
            action = CallNotificationActionReceiver.ACTION_CALL_RESPOND
            putExtra("call_id", callId)
            putExtra("call_action", "answer")
        }
        val acceptPending = PendingIntent.getBroadcast(
            this,
            (callId + "_ans").hashCode(),
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val declineIntent = Intent(this, CallNotificationActionReceiver::class.java).apply {
            action = CallNotificationActionReceiver.ACTION_CALL_RESPOND
            putExtra("call_id", callId)
            putExtra("call_action", "decline")
        }
        val declinePending = PendingIntent.getBroadcast(
            this,
            (callId + "_dec").hashCode(),
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_CALLS)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(if (isVideo) "📞 مكالمة فيديو واردة · $callerName" else "📞 مكالمة صوتية واردة · $callerName")
            .setContentText("اضغط للرد أو الرفض · TIGER CONNECT")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPending, true)
            .setContentIntent(fullScreenPending)
            .addAction(android.R.drawable.ic_menu_call, "رد / Answer", acceptPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "رفض / Decline", declinePending)

        if (!soundPrefs.silentMode && soundPrefs.vibrationEnabled) {
            builder.setVibrate(longArrayOf(0, 500, 250, 500, 250, 500))
        }

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_INSISTENT

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(callId.hashCode(), notification)
    }

    private fun showStandardNotification(
        notifId: Int,
        channelId: String,
        title: String,
        body: String,
        url: String,
        soundEnabled: Boolean,
        vibrateEnabled: Boolean
    ) {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_url", url)
        }
        val openPending = PendingIntent.getActivity(
            this,
            notifId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openPending)

        if (!soundEnabled) {
            builder.setSilent(true)
        }
        if (vibrateEnabled) {
            builder.setVibrate(longArrayOf(0, 180, 90, 180))
        }

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(notifId, builder.build())
    }

    private fun wakeScreenTemporarily() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            val wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "TigerConnect:IncomingCallWake"
            )
            wl.acquire(10_000L)
        } catch (_: Throwable) {
            // ignore
        }
    }

    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val audioAttr = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val callsChannel = NotificationChannel(
            CHANNEL_CALLS,
            "Incoming Calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Full-screen incoming voice and video calls"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 250, 500)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setSound(ringtoneUri, audioAttr)
        }

        val messagesChannel = NotificationChannel(
            CHANNEL_MESSAGES,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Incoming chat messages"
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL,
            "General Notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Missed calls & platform notifications"
        }

        nm.createNotificationChannel(callsChannel)
        nm.createNotificationChannel(messagesChannel)
        nm.createNotificationChannel(generalChannel)
    }

    private data class SoundPrefs(
        val silentMode: Boolean = false,
        val vibrationEnabled: Boolean = true,
        val callSoundEnabled: Boolean = true,
        val messageSoundEnabled: Boolean = true,
        val notificationSoundEnabled: Boolean = true
    )

    private fun parseSoundPrefs(raw: String?): SoundPrefs {
        if (raw.isNullOrBlank()) return SoundPrefs()
        return try {
            val obj = JSONObject(raw)
            SoundPrefs(
                silentMode = obj.optBoolean("silentMode", false),
                vibrationEnabled = obj.optBoolean("vibrationEnabled", true),
                callSoundEnabled = obj.optBoolean("callSoundEnabled", true),
                messageSoundEnabled = obj.optBoolean("messageSoundEnabled", true),
                notificationSoundEnabled = obj.optBoolean("notificationSoundEnabled", true)
            )
        } catch (_: Throwable) {
            SoundPrefs()
        }
    }
}
