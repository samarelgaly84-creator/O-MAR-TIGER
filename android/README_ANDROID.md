# TIGER CONNECT — Native Android Build & Firebase Setup

This directory contains the native Android integration for:
- **Android Share Target (`ACTION_SEND` & `ACTION_SEND_MULTIPLE`)** for text, URLs, images, videos, and files from WhatsApp, Telegram, Chrome, Gallery, etc.
- **Background & Lock-Screen Incoming Calls (`IncomingCallActivity` + `TigerFirebaseMessagingService`)** with real ringtone, vibration, caller photo/name, and Answer/Decline notification buttons.
- **Native Speakerphone Routing, Vibrator Haptics, & Sound Settings Sync (`TigerAndroid` WebView bridge)**.

## Required External Step Before Building the Signed APK
1. In your **Firebase Console** (matching the Firebase project configured for TIGER CONNECT), register an Android app with package name **`com.tiger.connect`**.
2. Download `google-services.json` from Firebase Console and place it at:
   `android/app/google-services.json`
3. Verify `TIGER_SERVER_URL` in `android/app/build.gradle` points to your live HTTPS server domain.
4. Open `android/` in **Android Studio** (or run `./gradlew assembleRelease` with Android SDK 35 installed) and install onto a physical Android device to test background FCM calls, lock-screen notifications, and OS sharing.
