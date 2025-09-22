# Publish GreenSeam to Google Play

This guide covers two approaches:

- Option A: Trusted Web Activity (TWA) – recommended, fastest path
- Option B: Capacitor – for native plugins or offline local bundle

Your repo already includes key PWA pieces in `front/`:
- `front/public/manifest.json`
- `front/public/sw.js`
- Registration in `front/app/ClientProviders.tsx`
- Digital Asset Links placeholder at `front/public/.well-known/assetlinks.json`

---

## Option A: Trusted Web Activity (recommended)

A TWA packages your HTTPS site as a fullscreen Chrome experience without browser UI.

### 0) Prereqs
- Deploy your site over HTTPS (e.g., Vercel). Note the production domain, e.g. `https://app.greenseam.ai`.
- Ensure the PWA is installable (run Lighthouse in Chrome DevTools on your production URL):
  - Web app manifest is valid and linked (already set via `front/app/layout.tsx` -> `manifest: '/manifest.json'`).
  - Service worker is registered in production (`front/app/ClientProviders.tsx` registers `/sw.js`).
  - Icons exist (192x192, 512x512, and maskable). Replace the placeholders in `front/public/` when you have final assets.

### 1) Install Bubblewrap (once)
```bash
npm i -g @bubblewrap/cli
```

### 2) Initialize the TWA project
Use your production URL and hosted manifest. Example:
```bash
bubblewrap init --manifest=https://YOUR_DOMAIN/manifest.json
# If you don’t host manifest yet, run:
# bubblewrap init
# and answer prompts (Start URL = https://YOUR_DOMAIN/)
```
This creates an Android project (usually in a new folder) configured to open your URL.

### 3) Digital Asset Links
Bubblewrap will output the SHA-256 fingerprint for your signing key and the Play App Signing certificate if you opt-in later. Update your website’s `assetlinks.json` accordingly:
- File: `front/public/.well-known/assetlinks.json`
- Replace:
  - `package_name`: the app package (e.g., `com.greenseam.app`)
  - `sha256_cert_fingerprints`: with your release signing cert (and Play App Signing cert if applicable)

Example structure (do not use this fingerprint):
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.greenseam.app",
      "sha256_cert_fingerprints": [
        "REPLACE_WITH_YOUR_RELEASE_KEY_SHA256_FINGERPRINT"
      ]
    }
  }
]
```
Commit and deploy so it’s served at:
```
https://YOUR_DOMAIN/.well-known/assetlinks.json
```

### 4) Build a signed release (AAB)
In the TWA project directory created by Bubblewrap:
```bash
bubblewrap build
```
- Create/choose a keystore for signing.
- Output will include an `.aab` suitable for Google Play.

### 5) Google Play Console
- Create a new app.
- Upload your `.aab` to the Internal testing track.
- Complete all listing items (screenshots, privacy policy, content rating, target API 34, etc.).
- Once validated, roll out to production.

Notes:
- Site updates are reflected instantly to users (it loads your live site), independent of app reviews.
- If you later change signing (e.g., enable Play App Signing), update `assetlinks.json` to include the Play-provided certificate fingerprint.

---

## Option B: Capacitor (hybrid)

Wraps your web app in a WebView. Choose this if you need native APIs (e.g., Push, Share plugin, file access) beyond what the web provides.

### 0) Considerations with Next.js
- If you load a remote URL (recommended for apps with server routes like Next.js API), set that in `capacitor.config.ts`.
- If you want to bundle local static files, you must `next export` (no SSR) and point Capacitor to the `out/` directory. Then host APIs separately.

### 1) Add Capacitor
```bash
# In repo root
pnpm add -w @capacitor/core @capacitor/cli
# Initialize
npx cap init "GreenSeam AI" com.greenseam.app
# Add Android
npx cap add android
```

### 2) Configure to load your deployed site
Create/edit `capacitor.config.ts` in repo root or `front/` package (depending on your workspace setup):
```ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.greenseam.app',
  appName: 'GreenSeam AI',
  webDir: 'front/.next', // not used when loading remote URL
  server: {
    url: 'https://YOUR_DOMAIN',
    cleartext: false,
  },
}
export default config
```
Then:
```bash
npx cap sync
npx cap open android
```

### 3) Optional plugins
If you later want Capacitor Share (you already check for `window.Capacitor` in the code):
```bash
pnpm add -w @capacitor/share
npx cap sync
```

### 4) Build signed AAB
In Android Studio:
- Build > Generate Signed App Bundle
- Configure a keystore or use Play App Signing
- Produce the `.aab` and upload to Play Console

Pros/Cons summary:
- TWA: simplest, uses live site, great for quick releases
- Capacitor: enables native plugins, but adds build complexity

---

## Checklist (quick)
- PWA installable on production domain
- `/.well-known/assetlinks.json` has real package name + cert fingerprints
- TWA project built with Bubblewrap and signed `.aab` produced
- Play Console listing complete; upload to Internal testing > Production

If you want, I can help update `assetlinks.json` once you provide:
- Production domain (exact URL)
- Desired Android package name
- SHA-256 fingerprint of your release keystore (or the Play App Signing certificate)
