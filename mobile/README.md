# GreenSeam Mobile (Capacitor)

This is a minimal Capacitor shell to run the existing Next.js app inside a native WebView for Android/iOS.

## Prereqs
- Android Studio (for Android emulator/device)
- Node 18+

## Configure
1. Edit `capacitor.config.ts` and set `server.url` to `http://YOUR_LAN_IP:3000`.
2. Set `appId` to your bundle id (e.g., `com.greenseam.app`).

## Run (Live Reload)
In a separate terminal:

- From `front/`: `npm install` then `npm run dev`
- From `mobile/`:
  - `npm install`
  - `npm run cap:add:android`
  - `npm run cap:open:android` (launches Android Studio)
  - Start an emulator, then `npm run cap:run:android:dev`

The app will load your dev server in a native WebView and reload on changes.

## Build for Production
- Change `server.url` to your production domain (HTTPS), or remove it and build web assets into `webDir`.
- Android: generate a keystore, set signing in Android Studio, produce an `.aab`.
- iOS: requires macOS/Xcode; set signing team and produce an `.ipa`.

## Deep Links / Universal Links
- Update `front/public/.well-known/assetlinks.json` with your release SHA256 fingerprint.
- Update `front/public/.well-known/apple-app-site-association` with your real TeamID and bundle id.
