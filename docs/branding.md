# NewsNeta Brand Assets

The source of truth is `assets/brand/v1/newsneta-official-source.jpg`, copied unchanged from the approved artwork.

Web, PWA, Android, email and social derivatives are generated mechanically by `scripts/generate-brand-assets.ps1`. The script preserves the original proportions and uses an exact crop of the first Telugu glyph for compact icons where the full wordmark would be unreadable.

The shared browser configuration is `assets/brand/brand-config.js`. Public headers, mobile headers, newsroom surfaces, the footer and loading states use its canonical paths. Existing compatibility logo filenames are regenerated from the official asset for older cached clients.

Hosted email image: `https://newsneta.com/assets/brand/v1/email-header.png`

Primary red sampled from the approved artwork: `#CE0203`.
