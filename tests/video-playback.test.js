const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "..");

test("media range parser handles browser byte range forms", async () => {
 const media = await import(pathToFileURL(path.join(root,"netlify/functions/media.mjs")));
 assert.deepEqual(media.parseRange("bytes=0-99",1000),{start:0,end:99});
 assert.deepEqual(media.parseRange("bytes=900-",1000),{start:900,end:999});
 assert.deepEqual(media.parseRange("bytes=-100",1000),{start:900,end:999});
 assert.equal(media.parseRange("bytes=1000-",1000).invalid,true);
});

test("ranged stream emits only requested bytes", async () => {
 const media = await import(pathToFileURL(path.join(root,"netlify/functions/media.mjs")));
 const source = new ReadableStream({start(c){c.enqueue(Uint8Array.from([0,1,2,3]));c.enqueue(Uint8Array.from([4,5,6,7,8,9]));c.close();}});
 const response = new Response(media.rangedStream(source,3,7));
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[3,4,5,6,7]);
});

test("media endpoint is publication-gated and constant-memory", () => {
 const source=fs.readFileSync(path.join(root,"netlify/functions/media.mjs"),"utf8");
 assert.match(source,/m\.status='approved'/); assert.match(source,/a\.status='published'/);
 assert.match(source,/Accept-Ranges/); assert.match(source,/status:\s*206/);
 assert.doesNotMatch(source,/arrayBuffer\s*\(/);
});

test("frontend includes real native and HLS playback lifecycle", () => {
 const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(source,/assets\/vendor\/hls\.min\.js/); assert.match(source,/video data-news-video/);
 assert.match(source,/Hls\.Events\.ERROR/); assert.match(source,/IntersectionObserver/);
 assert.match(source,/sorted\.filter\(story=>story\.video/);
 const playBody=source.match(/function playShortNews[\s\S]*?(?=document\.addEventListener)/)?.[0] || "";
 assert.match(playBody,/video\.play\(\)/); assert.doesNotMatch(playBody,/speakTelugu/);
});