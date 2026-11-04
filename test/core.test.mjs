import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Core = require("../extension/thumb-core.js");

const ID = "dQw4w9WgXcQ";
const base = "https://i.ytimg.com/vi/" + ID + "/";

test("認得 hqdefault 主縮圖", () => {
  const p = Core.parseThumb(base + "hqdefault.jpg");
  assert.equal(p.id, ID);
  assert.equal(p.family, "hq");
  assert.equal(p.kind, "wide");
  assert.equal(p.original, base + "hqdefault.jpg");
});

test("預設（自動）把 hqdefault 換成 hq2", () => {
  const p = Core.parseThumb(base + "hqdefault.jpg");
  assert.deepEqual(Core.chain(p, {}), [base + "hq2.jpg", base + "hqdefault.jpg"]);
});

test("搜尋頁常見的 hq720 會換成 maxres2", () => {
  const p = Core.parseThumb(base + "hq720.jpg");
  assert.equal(p.family, "hq720");
  assert.deepEqual(Core.chain(p, {}), [base + "maxres2.jpg", base + "hq2.jpg", base + "hq720.jpg"]);
});

test("maxresdefault 自動也走 maxres2", () => {
  const p = Core.parseThumb(base + "maxresdefault.jpg");
  assert.deepEqual(Core.chain(p, {}), [base + "maxres2.jpg", base + "hq2.jpg", base + "maxresdefault.jpg"]);
});

test("Shorts 直式縮圖換成 oar2，且不退回橫式", () => {
  const p = Core.parseThumb(base + "oardefault.jpg");
  assert.equal(p.kind, "vertical");
  assert.deepEqual(Core.chain(p, {}), [base + "oar2.jpg", base + "oardefault.jpg"]);
});

test("自訂封面 A/B 版本也認得", () => {
  const p = Core.parseThumb(base + "hq720_custom_2.jpg");
  assert.equal(p.family, "custom");
  assert.equal(Core.chain(p, {})[0], base + "maxres2.jpg");
});

test("手動指定清晰畫質：先 sd2 再 hq2 再原圖", () => {
  const p = Core.parseThumb(base + "maxresdefault.jpg");
  assert.deepEqual(Core.chain(p, { quality: "sd" }), [
    base + "sd2.jpg",
    base + "hq2.jpg",
    base + "maxresdefault.jpg"
  ]);
});

test("最高畫質", () => {
  const p = Core.parseThumb(base + "hqdefault.jpg");
  assert.equal(Core.chain(p, { quality: "maxres" })[0], base + "maxres2.jpg");
});

test("取幀位置 1／3 會換檔名", () => {
  assert.equal(Core.buildUrl(ID, "maxres", 1), base + "maxres1.jpg");
  assert.equal(Core.buildUrl(ID, "mq", 3), base + "mq3.jpg");
  assert.equal(Core.buildUrl(ID, "oar", 1), base + "oar1.jpg");
});

test("不支援的值退回預設", () => {
  const s = Core.normalizeSettings({ quality: "8k", frame: 9, enabled: "no" });
  assert.equal(s.quality, "auto");
  assert.equal(s.frame, 2);
  assert.equal(s.enabled, true);
});

test("直播主縮圖 _live 不動", () => {
  assert.equal(Core.parseThumb(base + "hqdefault_live.jpg"), null);
});

test("已經是某個第 N 幀就不要再改", () => {
  for (const name of ["hq2.jpg", "maxres2.jpg", "oar2.jpg", "hq720_2.jpg", "sd1.jpg"]) {
    assert.equal(Core.parseThumb(base + name), null, name);
  }
});

test("其他圖床與壞網址不動", () => {
  assert.equal(Core.parseThumb("https://yt3.ggpht.com/abc/photo.jpg"), null);
  assert.equal(Core.parseThumb("https://i.ytimg.com/vi/short/hqdefault.jpg"), null);
  assert.equal(Core.parseThumb("data:image/gif;base64,R0lGOD"), null);
  assert.equal(Core.parseThumb(""), null);
  assert.equal(Core.parseThumb(null), null);
});

test("協定相對網址與 query string", () => {
  const p = Core.parseThumb("//i.ytimg.com/vi/" + ID + "/hqdefault.jpg?sqp=abc&rs=1");
  assert.equal(p.id, ID);
  assert.equal(p.original, base + "hqdefault.jpg?sqp=abc&rs=1");
  assert.equal(Core.chain(p, {})[0], base + "hq2.jpg");
});

test("key 會隨設定與來源改變", () => {
  const a = Core.parseThumb(base + "hqdefault.jpg");
  const b = Core.parseThumb(base + "hq720.jpg");
  assert.notEqual(Core.keyFor(a, { frame: 2 }), Core.keyFor(a, { frame: 3 }));
  assert.notEqual(Core.keyFor(a, {}), Core.keyFor(b, {}));
});
