/* YouTube 中段縮圖 ── 內容腳本
 * 把頁面上的主縮圖（*default.jpg）換成 YouTube 自動截的第 2 幀（中段）。
 * 只改 img.src，不會下載或播放影片。
 */
(() => {
  "use strict";

  const Core = globalThis.YTSM;
  if (!Core) return;

  const STORAGE_KEY = "settings";
  const OBSERVE_OPTIONS = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  };

  let settings = Core.normalizeSettings({});
  let active = false;
  let observing = false;
  let replacedCount = 0;

  const queue = new Set();
  let scheduled = false;

  /* ── 單張縮圖 ─────────────────────────────────────────── */

  function failKey(parsed) {
    return "fail|" + Core.keyFor(parsed, settings);
  }

  function loadStep(img, step) {
    const chain = (img.dataset.ytsmChain || "").split("\n").filter(Boolean);
    if (step >= chain.length) {
      finishFail(img);
      return;
    }
    const next = chain[step];
    // 退回原圖時就不再算「已替換」，計數要跟著減
    if (next === img.dataset.ytsmOrig && img.dataset.ytsmApplied === "1") {
      img.dataset.ytsmApplied = "0";
      replacedCount = Math.max(0, replacedCount - 1);
    }
    img.dataset.ytsmStep = String(step);
    if (img.getAttribute("src") !== next) img.setAttribute("src", next);
  }

  function finishFail(img) {
    const original = img.dataset.ytsmOrig;
    const key = img.dataset.ytsmKey;
    delete img.dataset.ytsmChain;
    delete img.dataset.ytsmStep;
    img.dataset.ytsmKey = "fail|" + (key || "");
    if (img.dataset.ytsmApplied === "1") {
      img.dataset.ytsmApplied = "0";
      replacedCount = Math.max(0, replacedCount - 1);
    }
    if (original && img.getAttribute("src") !== original) img.setAttribute("src", original);
    if (img.dataset.ytsmSrcset) {
      img.setAttribute("srcset", img.dataset.ytsmSrcset);
      delete img.dataset.ytsmSrcset;
    }
  }

  function applyToImage(img) {
    if (!active || !(img instanceof HTMLImageElement)) return;
    const src = img.getAttribute("src");
    if (!src) return;

    const parsed = Core.parseThumb(src);
    if (!parsed) return;

    const wanted = Core.keyFor(parsed, settings);
    if (img.dataset.ytsmKey === wanted) return;
    if (img.dataset.ytsmKey === failKey(parsed)) return;

    img.dataset.ytsmKey = wanted;
    img.dataset.ytsmOrig = parsed.original;
    // srcset 的優先權高於 src，不拿掉的話換了 src 也不會生效
    if (img.hasAttribute("srcset")) {
      img.dataset.ytsmSrcset = img.getAttribute("srcset");
      img.removeAttribute("srcset");
    }
    img.dataset.ytsmChain = Core.chain(parsed, settings).join("\n");
    img.dataset.ytsmStep = "0";
    if (img.dataset.ytsmApplied !== "1") {
      img.dataset.ytsmApplied = "1";
      replacedCount += 1;
    }
    loadStep(img, 0);
  }

  /* 某個尺寸不存在時退到下一個候選，最後一定回到原圖。 */
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (!img.dataset.ytsmChain) return;
      const next = Number(img.dataset.ytsmStep || 0) + 1;
      if (next < img.dataset.ytsmChain.split("\n").length) loadStep(img, next);
      else finishFail(img);
    },
    true
  );

  /* ── 掃描與監看 ───────────────────────────────────────── */

  function enqueue(node) {
    if (!(node instanceof HTMLImageElement)) return;
    queue.add(node);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      if (!scheduled) return;
      scheduled = false;
      flush();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    setTimeout(run, 200); // 背景分頁不觸發 rAF，補一個計時器
  }

  function flush() {
    const batch = Array.from(queue);
    queue.clear();
    for (const img of batch) {
      try {
        applyToImage(img);
      } catch (err) {
        /* 單張失敗不影響其他縮圖 */
      }
    }
  }

  function sweep(root) {
    const scope = root || document;
    if (scope instanceof HTMLImageElement) {
      enqueue(scope);
      return;
    }
    if (!scope.querySelectorAll) return;
    for (const img of scope.querySelectorAll("img")) enqueue(img);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        enqueue(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node instanceof HTMLImageElement) enqueue(node);
        else if (node.querySelectorAll) for (const img of node.querySelectorAll("img")) enqueue(img);
      }
    }
  });

  function startObserver() {
    if (observing) return;
    observer.observe(document.documentElement, OBSERVE_OPTIONS);
    observing = true;
  }

  function stopObserver() {
    if (!observing) return;
    observer.disconnect();
    observing = false;
  }

  /* ── 設定切換 ─────────────────────────────────────────── */

  function resetAll() {
    for (const img of document.querySelectorAll("img[data-ytsm-orig]")) {
      const original = img.dataset.ytsmOrig;
      delete img.dataset.ytsmKey;
      delete img.dataset.ytsmChain;
      delete img.dataset.ytsmStep;
      delete img.dataset.ytsmApplied;
      delete img.dataset.ytsmOrig;
      if (original && img.getAttribute("src") !== original) img.setAttribute("src", original);
      if (img.dataset.ytsmSrcset) {
        img.setAttribute("srcset", img.dataset.ytsmSrcset);
        delete img.dataset.ytsmSrcset;
      }
    }
    replacedCount = 0;
  }

  function boot() {
    resetAll();
    active = true;
    startObserver();
    sweep();
  }

  function shutdown() {
    active = false;
    stopObserver();
    resetAll();
  }

  function applySettings(saved) {
    settings = Core.normalizeSettings(saved);
    if (settings.enabled) boot();
    else shutdown();
  }

  /* ── 啟動 ─────────────────────────────────────────────── */

  function readSettings() {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.sync) {
          resolve({});
          return;
        }
        chrome.storage.sync.get(STORAGE_KEY, (got) => {
          if (chrome.runtime.lastError) resolve({});
          else resolve((got && got[STORAGE_KEY]) || {});
        });
      } catch (err) {
        resolve({});
      }
    });
  }

  readSettings().then((saved) => {
    settings = Core.normalizeSettings(saved);
    if (settings.enabled) boot();
    watchNavigation();
  });

  function watchNavigation() {
    for (const name of ["yt-navigate-finish", "yt-page-data-updated"]) {
      window.addEventListener(name, () => {
        if (!active) return;
        replacedCount = 0;
        setTimeout(() => active && sweep(), 250);
        setTimeout(() => active && sweep(), 1200);
      });
    }
  }

  /* 保險用的定時掃描：延遲載入偶爾不會觸發 mutation。 */
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    if (active) sweep();
    if (ticks >= 12) clearInterval(timer);
  }, 2000);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[STORAGE_KEY]) return;
    applySettings(changes[STORAGE_KEY].newValue);
  });

  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (!message || message.type !== "ytsm:status") return;
    reply({ count: replacedCount, active, settings });
  });
})();
