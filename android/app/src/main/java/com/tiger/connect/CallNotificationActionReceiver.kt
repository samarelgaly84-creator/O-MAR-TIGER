package com.tiger.connect

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class CallNotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_CALL_RESPOND = "com.tiger.connect.CALL_ACTION"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val callId = intent.getStringExtra("call_id") ?: return
        val callAction = intent.getStringExtra("call_action") ?: return

        // Dismiss ringing notification and any open IncomingCallActivity
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(callId.hashCode())
        context.sendBroadcast(
            Intent(TigerFirebaseMessagingService.ACTION_CANCEL_CALL_UI)
                .setPackage(context.packageName)
                .putExtra("call_id", callId)
        )

        if (callAction == "answer") {
            val launch = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("call_action", "answer")
                putExtra("call_id", callId)
            }
            context.startActivity(launch)
            return
        }

        if (callAction == "decline") {
            val prefs = context.getSharedPreferences("TigerPrefs", Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", "") ?: ""
            if (token.isNotBlank()) {
                val pending = goAsync()
                Thread {
                    try {
                        val endpoint = "${BuildConfig.TIGER_SERVER_URL}/api/calls/${callId}/respond"
                        val conn = URL(endpoint).openConnection() as HttpURLConnection
                        conn.requestMethod = "POST"
                        conn.setRequestProperty("Content-Type", "application/json")
                        conn.setRequestProperty("Authorization", "Bearer $token")
                        conn.doOutput = true
                        conn.connectTimeout = 5000
                        conn.readTimeout = 5000
                        OutputStreamWriter(conn.outputStream).use {
                            it.write(JSONObject().put("action", "decline").toString())
                        }
                        conn.responseCode
                        conn.disconnect()
                    } catch (_: Throwable) {
                    } finally {
                        pending.finish()
                    }
                }.start()
            }
        }
    }
}
