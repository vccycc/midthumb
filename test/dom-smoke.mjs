/* 用最小假 DOM 跑一次 content.js：換圖 → 載入失敗回退 → 關閉還原。
 * 這不是瀏覽器實測，只證明腳本邏輯不會拋錯、狀態會收斂。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ID = "dQw4w9WgXcQ";
const OTHER = "aaaaaaaaaaa";
const thumb = (id, name) => "https://i.ytimg.com/vi/" + id + "/" + name;

const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms, ...rest) => {
  const handle = realSetInterval(fn, ms, ...rest);
  if (handle && typeof handle.unref === "function") handle.unref();
  return handle;
};

class FakeImage {
  constructor(src) {
    this.attrs = new Map();
    this.dataset = {};
    if (src) this.setAttribute("src", src);
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }
  hasAttribute(name) {
    return this.attrs.has(name);
  }
  removeAttribute(name) {
    this.attrs.delete(name);
  }
  get src() {
    return this.getAttribute("src");
  }
}

const images = [];
const errorListeners = [];

globalThis.HTMLImageElement = FakeImage;
globalThis.document = {
  documentElement: {},
  querySelectorAll(selector) {
    if (selector === "img[data-ytsm-orig]") {
      return images.filter((img) => img.dataset.ytsmOrig !== undefined);
    }
    if (selector === "img") return images.slice();
    return [];
  },
  addEventListener(type, handler) {
    if (type === "error") errorListeners.push(handler);
  }
};
globalThis.window = { addEventListener() {} };
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

let storageListener = null;
let messageListener = null;
const saved = {};

globalThis.chrome = {
  runtime: { lastError: undefined, onMessage: { addListener: (fn) => (messageListener = fn) } },
  storage: {
    sync: { get(_key, cb) { cb({ settings: saved }); } },
    onChanged: { addListener(fn) { storageListener = fn; } }
  }
};

const main = new FakeImage(thumb(ID, "hqdefault.jpg"));
const plain = new FakeImage("https://yt3.ggpht.com/avatar/photo.jpg");
const broken = new FakeImage(thumb(OTHER, "hqdefault.jpg"));
const withSrcset = new FakeImage(thumb("bbbbbbbbbbb", "hqdefault.jpg"));
withSrcset.setAttribute("srcset", thumb("bbbbbbbbbbb", "hqdefault.jpg") + " 1x, " + thumb("bbbbbbbbbbb", "maxresdefault.jpg") + " 2x");
images.push(main, plain, broken, withSrcset);

const coreCode = readFileSync(new URL("../extension/thumb-core.js", import.meta.url), "utf8");
const contentCode = readFileSync(new URL("../extension/content.js", import.meta.url), "utf8");
new Function(coreCode)();
new Function(contentCode)();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function status() {
  let reply = null;
  if (messageListener) messageListener({ type: "ytsm:status" }, {}, (value) => (reply = value));
  return reply;
}

function fireError(img) {
  for (const listener of errorListeners) listener({ target: img });
}

await wait(120);

test("把 hqdefault 換成中段 hq2", () => {
  assert.equal(main.src, thumb(ID, "hq2.jpg"));
  assert.equal(main.dataset.ytsmApplied, "1");
});

test("不相干的圖片不動", () => {
  assert.equal(plain.src, "https://yt3.ggpht.com/avatar/photo.jpg");
  assert.equal(plain.dataset.ytsmOrig, undefined);
});

test("狀態回報張數", () => {
  const res = status();
  assert.equal(res.active, true);
  assert.equal(res.count, 3);
  assert.equal(res.settings.frame, 2);
});

test("srcset 會先拿掉，否則 src 換了也沒用", () => {
  assert.equal(withSrcset.hasAttribute("srcset"), false);
  assert.equal(withSrcset.src, thumb("bbbbbbbbbbb", "hq2.jpg"));
  assert.equal(typeof withSrcset.dataset.ytsmSrcset, "string");
});

test("載入失敗時回到原圖", () => {
  fireError(main);
  assert.equal(main.src, thumb(ID, "hqdefault.jpg"));
});

test("連原始網址都失敗就記住，不再重試", () => {
  fireError(broken); // hq2 失敗 → 退回原圖
  fireError(broken); // 原圖也失敗 → 放棄
  assert.equal(broken.dataset.ytsmKey.startsWith("fail|"), true);
  assert.equal(broken.dataset.ytsmApplied, "0");
  assert.equal(status().count, 1);
});

test("停用後全部還原", async () => {
  storageListener({ settings: { newValue: { enabled: false } } }, "sync");
  await wait(30);
  assert.equal(main.src, thumb(ID, "hqdefault.jpg"));
  assert.equal(main.dataset.ytsmOrig, undefined);
  assert.equal(withSrcset.hasAttribute("srcset"), true);
  assert.equal(status().active, false);
});

test("重新啟用會用新的設定再換一次", async () => {
  storageListener({ settings: { newValue: { enabled: true, frame: 3 } } }, "sync");
  await wait(60);
  assert.equal(main.src, thumb(ID, "hq3.jpg"));
  assert.equal(broken.src, thumb(OTHER, "hq3.jpg"));
  assert.equal(withSrcset.src, thumb("bbbbbbbbbbb", "hq3.jpg"));
  assert.equal(withSrcset.hasAttribute("srcset"), false);
  assert.equal(status().count, 3);
});
