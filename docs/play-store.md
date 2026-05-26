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
- Bubblewrap CLI: `npm install -g @bubblewrap/cli`
- Google Play Console developer account

## Generate Android Project

```bash
cd android
bubblewrap init --manifest ./twa-manifest.json
```

When prompted for signing, use the NewsNeta release keystore. Keep the keystore and passwords private and do not commit them to GitHub.

## Build Play Store Bundle

```bash
cd android
bubblewrap build
```

Upload the generated `.aab` file to Google Play Console.

## Play Store Checklist

- App name: `NewsNeta - Telugu News`
- Default language: Telugu or English India
- Category: News & Magazines
- Privacy policy URL: add before production listing
- Content rating: complete in Play Console
- Data safety: declare analytics, push notifications, and any account data actually collected
- Screenshots: provide phone screenshots for 6.7-inch and 5.5-inch layouts
- App access: mark as no login required for reader app, unless CMS/admin is included in the app listing

## Important

Only the Google Play account owner can complete the final submission, content rating, data safety form, and production rollout approval.
