const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "manifest.json",
  "sw.js",
  ".well-known/assetlinks.json",
  "android/twa-manifest.json",
  "assets/app/icon-192.png",
  "assets/app/icon-512.png",
  "assets/app/maskable-192.png",
  "assets/app/maskable-512.png"
];

const failures = [];

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`${file} is missing`);
}

const manifest = readJson("manifest.json");
if (manifest) {
  if (manifest.display !== "standalone") failures.push("manifest display must be standalone");
  if (manifest.start_url !== "/") failures.push("manifest start_url should be /");
  if (manifest.scope !== "/") failures.push("manifest scope should be /");
  const icons = manifest.icons || [];
  for (const expected of ["assets/app/icon-192.png", "assets/app/icon-512.png", "assets/app/maskable-512.png"]) {
    if (!icons.some(icon => icon.src === expected)) failures.push(`manifest icon missing: ${expected}`);
  }
  if (!icons.some(icon => String(icon.purpose || "").includes("maskable"))) failures.push("manifest needs at least one maskable icon");
}

const twa = readJson("android/twa-manifest.json");
if (twa) {
  if (twa.packageId !== "com.newsneta.twa") failures.push("TWA packageId must be com.newsneta.twa");
  if (twa.host !== "newsneta.com") failures.push("TWA host must be newsneta.com");
  if (twa.webManifestUrl !== "https://newsneta.com/manifest.json") failures.push("TWA webManifestUrl must point to production manifest");
  if (!twa.signingKey?.path || !twa.signingKey?.alias) failures.push("TWA signing key path and alias are required");
}

const assetLinks = readJson(".well-known/assetlinks.json");
if (assetLinks) {
  const target = assetLinks[0]?.target;
  if (target?.package_name !== "com.newsneta.twa") failures.push("assetlinks package_name must match TWA packageId");
  if (!Array.isArray(target?.sha256_cert_fingerprints) || !target.sha256_cert_fingerprints.length) failures.push("assetlinks requires a release certificate fingerprint");
}

if (failures.length) {
  console.error("Play Store readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Play Store readiness check passed.");
