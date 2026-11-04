/* 檢查 manifest 引用的檔案都在、圖示尺寸正確 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ext = path.join(root, "extension");
const problems = [];

const manifest = JSON.parse(readFileSync(path.join(ext, "manifest.json"), "utf8"));

function mustExist(rel, label) {
  if (!existsSync(path.join(ext, rel))) problems.push(label + " 找不到：" + rel);
}

for (const [size, rel] of Object.entries(manifest.icons || {})) mustExist(rel, "icons[" + size + "]");
for (const [size, rel] of Object.entries(manifest.action?.default_icon || {})) mustExist(rel, "action.icon[" + size + "]");
if (manifest.action?.default_popup) mustExist(manifest.action.default_popup, "popup");
for (const script of manifest.content_scripts || []) {
  for (const file of script.js || []) mustExist(file, "content_scripts.js");
  for (const file of script.css || []) mustExist(file, "content_scripts.css");
}

for (const [size, rel] of Object.entries(manifest.icons || {})) {
  const buf = readFileSync(path.join(ext, rel));
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width !== Number(size) || height !== Number(size)) {
    problems.push("圖示尺寸不符：" + rel + " 是 " + width + "×" + height + "，manifest 寫 " + size);
  }
}

const html = readFileSync(path.join(ext, manifest.action.default_popup), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(https?:|data:|#)/.test(match[1])) continue;
  mustExist(match[1], "popup 引用");
}

if (manifest.manifest_version !== 3) problems.push("manifest_version 應為 3");

if (problems.length) {
  console.error("✖ 發現 " + problems.length + " 個問題：");
  for (const problem of problems) console.error("  - " + problem);
  process.exit(1);
}
console.log("✔ manifest 引用檔案齊全，圖示尺寸正確");
