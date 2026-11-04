/* 彈出視窗：讀寫設定、顯示目前分頁換了幾張 */
(() => {
  "use strict";

  const STORAGE_KEY = "settings";
  const DEFAULTS = { enabled: true, quality: "auto", frame: 2 };

  const verEl = document.getElementById("ver");
  if (verEl && chrome.runtime && chrome.runtime.getManifest) {
    verEl.textContent = "v" + chrome.runtime.getManifest().version;
  }

  const el = {
    enabled: document.getElementById("enabled"),
    quality: document.getElementById("quality"),
    frame: document.getElementById("frame"),
    status: document.getElementById("status"),
    rows: document.getElementById("rows")
  };

  function readSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(STORAGE_KEY, (got) => {
        resolve(Object.assign({}, DEFAULTS, (got && got[STORAGE_KEY]) || {}));
      });
    });
  }

  function writeSettings(next) {
    chrome.storage.sync.set({ [STORAGE_KEY]: next });
  }

  function setStatus(text, warn) {
    el.status.textContent = text;
    el.status.classList.toggle("warn", Boolean(warn));
  }

  function paintDisabled(enabled) {
    el.rows.classList.toggle("disabled", !enabled);
  }

  function askPage() {
    return chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs && tabs[0];
        if (!tab) throw new Error("no-tab");
        return chrome.tabs.sendMessage(tab.id, { type: "ytsm:status" });
      });
  }

  function refreshStatus() {
    askPage()
      .then((res) => {
        if (!res) {
          setStatus("這個頁面沒有回應，請重新整理 YouTube。", true);
          return;
        }
        if (!res.active) setStatus("已停用：顯示 YouTube 原本的縮圖。");
        else if (res.count > 0) setStatus("這個分頁已換上 " + res.count + " 張中段縮圖。");
        else setStatus("這個頁面目前沒有可替換的縮圖。");
      })
      .catch(() => {
        setStatus("設定已儲存；切到 YouTube 分頁（或重新整理）即生效。", true);
      });
  }

  readSettings().then((saved) => {
    el.enabled.checked = saved.enabled !== false;
    el.quality.value = ["auto", "mq", "hq", "sd", "maxres"].includes(saved.quality) ? saved.quality : DEFAULTS.quality;
    el.frame.value = ["1", "2", "3"].includes(String(saved.frame)) ? String(saved.frame) : "2";
    paintDisabled(el.enabled.checked);
    refreshStatus();
  });

  el.enabled.addEventListener("change", () => {
    const enabled = el.enabled.checked;
    paintDisabled(enabled);
    readSettings().then((cur) => {
      writeSettings(Object.assign({}, cur, { enabled }));
      setStatus(enabled ? "已啟用。" : "已停用。");
      setTimeout(refreshStatus, 700);
    });
  });

  el.quality.addEventListener("change", () => {
    readSettings().then((cur) => {
      writeSettings(Object.assign({}, cur, { quality: el.quality.value }));
      setStatus("已套用畫質設定。");
      setTimeout(refreshStatus, 900);
    });
  });

  el.frame.addEventListener("change", () => {
    readSettings().then((cur) => {
      writeSettings(Object.assign({}, cur, { frame: Number(el.frame.value) }));
      setStatus("已套用取幀設定。");
      setTimeout(refreshStatus, 900);
    });
  });
})();
