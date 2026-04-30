#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-env
// Thin-client knowledge sync — pulls the latest bundle from master and
// unpacks it into the project so the local Lovable AI uses fresh rules.
//
// Usage (auto-triggered by AI on every chat message):
//   deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
//
// Behavior:
//   1. GET https://<MASTER>.supabase.co/functions/v1/get-knowledge-bundle-version
//      → { hash, url, fileCount, byteSize, publishedAt }
//   2. Compare hash vs ./knowledge/.bundle-hash. If equal → exit 0 (no-op).
//   3. Download the zip, unpack into ./knowledge/.
//   4. Write the new hash to ./knowledge/.bundle-hash.

const MASTER_PROJECT_REF = "iqxcgazfrydubrvxmnlv";
const VERSION_URL = `https://${MASTER_PROJECT_REF}.supabase.co/functions/v1/get-knowledge-bundle-version`;
const KNOWLEDGE_DIR = "./knowledge";
const HASH_FILE = `${KNOWLEDGE_DIR}/.bundle-hash`;

async function readHashFile(): Promise<string | null> {
  try { return (await Deno.readTextFile(HASH_FILE)).trim(); }
  catch { return null; }
}

const versionResp = await fetch(VERSION_URL);
if (!versionResp.ok) {
  console.error(`Failed to fetch bundle version: ${versionResp.status}`);
  Deno.exit(1);
}
const version = await versionResp.json();
const localHash = await readHashFile();

if (localHash === version.hash) {
  console.log(`✓ knowledge up to date (${version.hash})`);
  Deno.exit(0);
}

console.log(`Downloading bundle ${version.hash} (${version.fileCount} files, ${(version.byteSize / 1024).toFixed(1)} KB)…`);
const zipResp = await fetch(version.url);
if (!zipResp.ok) {
  console.error(`Failed to download bundle: ${zipResp.status}`);
  Deno.exit(1);
}
const zipBytes = new Uint8Array(await zipResp.arrayBuffer());

// Unpack with jszip
const { default: JSZip } = await import("npm:jszip@3.10.1");
const zip = await JSZip.loadAsync(zipBytes);

await Deno.mkdir(KNOWLEDGE_DIR, { recursive: true });
let written = 0;
for (const [path, entry] of Object.entries(zip.files)) {
  if ((entry as any).dir) continue;
  const content = await (entry as any).async("string");
  const target = `${KNOWLEDGE_DIR}/${path}`;
  const dir = target.split("/").slice(0, -1).join("/");
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(target, content);
  written++;
}

await Deno.writeTextFile(HASH_FILE, version.hash);
console.log(`✓ synced ${written} files → ${KNOWLEDGE_DIR}/ (hash ${version.hash})`);
