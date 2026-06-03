# NewsNeta Android / Play Store Deployment

NewsNeta is configured as an installable PWA and can be published to Google Play as a Trusted Web Activity Android app.

## Current App Details

- Production URL: `https://newsneta.com`
- Android package: `com.newsneta.twa`
- Web App Manifest: `https://newsneta.com/manifest.json`
- Digital Asset Links: `https://newsneta.com/.well-known/assetlinks.json`
- TWA config: `android/twa-manifest.json`

## Build Requirements

Install these locally before generating the Play Store build:

- Java 17 or newer
- Android Studio with Android SDK
- Android SDK platform for the current Google Play target API requirement
- Bubblewrap CLI: `npm install -g @bubblewrap/cli`
- Google Play Console developer account

As of June 2026, Google Play requires new apps and updates to target Android 15 / API level 35 or higher. Build the TWA with an up-to-date Android SDK and current Bubblewrap/Gradle tooling.

## Readiness Check

Run this before building:

```bash
npm run check
npm run check:playstore
```

The Play Store readiness check validates the PWA manifest, app icons, Digital Asset Links, and TWA config.

## Generate Android Project

```bash
cd android
bubblewrap init --manifest ./twa-manifest.json
```

When prompted for signing, use the NewsNeta release keystore:

- Package name: `com.newsneta.twa`
- Signing alias: `newsneta`
- Expected keystore path: `android/newsneta-release.keystore`

Keep the keystore and passwords private. They are intentionally ignored by Git.

## Build Play Store Bundle

```bash
cd android
bubblewrap build
```

Upload the generated `.aab` file to Google Play Console.

If Bubblewrap generates a full Android project, commit only safe project files. Do not commit release keystores, passwords, or Play Console credentials.

## Play Store Checklist

- App name: `NewsNeta - Telugu News`
- Default language: Telugu or English India
- Category: News & Magazines
- Privacy policy URL: add before production listing
- Content rating: complete in Play Console
- Data safety: declare analytics, push notifications, and any account data actually collected
- Screenshots: provide phone screenshots for 6.7-inch and 5.5-inch layouts
- App access: mark as no login required for reader app, unless CMS/admin is included in the app listing
- Target SDK: Android 15 / API 35 or newer
- Release type: Android App Bundle (`.aab`)
- Deep links: confirm `https://newsneta.com/.well-known/assetlinks.json` matches the release certificate fingerprint
- Testing: complete internal testing before production rollout

## Important

Only the Google Play account owner can complete the final submission, content rating, data safety form, and production rollout approval.
