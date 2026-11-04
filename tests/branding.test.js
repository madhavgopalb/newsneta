const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));

function pngDimensions(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("official branding is centralized and exposed through reusable components", () => {
  const config = read("assets/brand/brand-config.js");
  for (const name of ["BrandLogo", "SiteHeader", "MobileHeader", "NewsroomHeader", "AppIcon", "EmailHeader", "FooterBrand", "LoadingBrand"]) {
    assert.match(config, new RegExp(`\\b${name}\\b`));
  }
  assert.match(config, /primary: "#CE0203"/);
});

test("official source and optimized derivatives have expected dimensions", () => {
  const required = [
    "assets/brand/v1/newsneta-official-source.jpg",
    "assets/brand/v1/wordmark-desktop.png",
    "assets/brand/v1/wordmark-mobile.png",
    "assets/brand/v1/email-header.png",
    "assets/brand/v1/social-share-1200x630.png",
    "assets/brand/v1/splash-1242x2688.png",
    "assets/brand/v1/favicon-32.png",
    "assets/brand/v1/favicon-48.png",
    "assets/brand/v1/apple-touch-icon-180.png",
    "assets/app/icon-192.png",
    "assets/app/icon-512.png",
    "assets/app/maskable-192.png",
    "assets/app/maskable-512.png",
    "android/branding/launcher-512.png",
    "android/branding/launcher-maskable-512.png"
  ];
  required.forEach(file => assert.ok(exists(file), `${file} should exist`));
  assert.deepEqual(pngDimensions("assets/brand/v1/wordmark-desktop.png"), { width: 1280, height: 552 });
  assert.deepEqual(pngDimensions("assets/brand/v1/social-share-1200x630.png"), { width: 1200, height: 630 });
  assert.deepEqual(pngDimensions("assets/app/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions("assets/app/maskable-512.png"), { width: 512, height: 512 });
});

test("public, newsroom, footer and loading surfaces use official branding", () => {
  const page = read("index.html");
  assert.match(page, /data-brand-variant="desktop"/);
  assert.match(page, /data-brand-variant="footer"/);
  assert.match(page, /data-brand-variant="newsroom"/);
  assert.match(page, /components\?\.LoadingBrand/);
  assert.match(page, /social-share-1200x630\.png/);
  assert.doesNotMatch(page, /src="assets\/newsneta-logo-(?:header|transparent)\.png"/);
});

test("PWA, Android and service worker use versioned official assets", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const twa = JSON.parse(read("android/twa-manifest.json"));
  const serviceWorker = read("sw.js");
  assert.equal(manifest.theme_color, "#CE0203");
  manifest.icons.forEach(icon => assert.match(icon.src, /\?v=brand-v1$/));
  assert.match(twa.iconUrl, /\?v=brand-v1$/);
  assert.equal(twa.appVersionCode, 2);
  assert.match(serviceWorker, /CACHE_VERSION = "v96"/);
  assert.match(serviceWorker, /assets\/brand\/v1\/wordmark-desktop\.png/);
});
