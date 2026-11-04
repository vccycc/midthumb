/* YouTube 中段縮圖 ── 共用邏輯（不碰 DOM，可在 Node 測試）
 *
 * YouTube 對每支影片都自動截三張播放中的畫面，檔名結尾是 1、2、3：
 *   https://i.ytimg.com/vi/<id>/hq2.jpg      480×360   橫式
 *   https://i.ytimg.com/vi/<id>/maxres2.jpg  1280×720  橫式（= hq720_2.jpg）
 *   https://i.ytimg.com/vi/<id>/oar2.jpg     1080×1920 直式（Shorts）
 * 頁面上顯示的主縮圖則是 *default.jpg 或 hq720.jpg。
 * 這裡只負責：認出主縮圖，換成同一支影片的第 N 幀。
 */
(function (root) {
  "use strict";

  var DEFAULTS = { enabled: true, quality: "auto", frame: 2 };

  var HOSTS = ["i.ytimg.com", "img.youtube.com"];

  /* /vi/<id>/hqdefault.jpg、/vi_webp/<id>/maxresdefault.webp */
  var PATH_RE = /^\/(vi|vi_webp)\/([A-Za-z0-9_-]{11})\/([A-Za-z0-9_]+)\.(?:jpg|jpeg|webp|png)$/i;

  var VALID_QUALITY = { auto: 1, mq: 1, hq: 1, sd: 1, maxres: 1 };
  var VALID_FAMILY = { mq: 1, hq: 1, sd: 1, maxres: 1, oar: 1 };

  function normalizeSettings(input) {
    var s = Object.assign({}, DEFAULTS, input || {});
    if (!VALID_QUALITY[s.quality]) s.quality = DEFAULTS.quality;
    var f = Number(s.frame);
    s.frame = f === 1 || f === 3 ? f : 2;
    s.enabled = s.enabled !== false;
    return s;
  }

  /* 主縮圖檔名 → 它屬於哪個尺寸家族；不是主縮圖就回傳 null。 */
  function classify(name) {
    var n = name.toLowerCase();

    if (n === "hq720") return { family: "hq720", kind: "wide" };
    if (n === "oardefault") return { family: "oar", kind: "vertical" };

    var m = /^(maxres|sd|hq|mq|)default$/.exec(n);
    if (m) return { family: m[1] || "default", kind: "wide" };

    /* 自訂封面的 A/B 版本：hq720_custom_2、hqdefault_custom_1… */
    if (/^(maxres|sd|hq720|hq|mq)?default_custom_\d+$/.test(n) || /^hq720_custom_\d+$/.test(n)) {
      return { family: "custom", kind: "wide" };
    }
    return null;
  }

  function parseThumb(src) {
    if (typeof src !== "string" || !src) return null;
    if (src.slice(0, 5) === "data:" || src.slice(0, 5) === "blob:") return null;

    var u;
    try {
      u = new URL(src, "https://www.youtube.com/");
    } catch (e) {
      return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (HOSTS.indexOf(u.hostname.toLowerCase()) === -1) return null;

    var m = PATH_RE.exec(u.pathname);
    if (!m) return null;

    if (/_live$/i.test(m[3])) return null; // 直播主縮圖沒有 1/2/3 幀
    var info = classify(m[3]);
    if (!info) return null;

    return {
      id: m[2],
      variant: m[1].toLowerCase(),
      family: info.family,
      kind: info.kind,
      name: m[3].toLowerCase(),
      original: u.href
    };
  }

  /* 使用者選的畫質 → 目標家族；auto 依原圖大小決定 */
  function targetFamily(parsed, settings) {
    if (parsed.kind === "vertical") return "oar";
    var q = normalizeSettings(settings).quality;
    if (q !== "auto") return q;
    if (parsed.family === "hq720" || parsed.family === "maxres" || parsed.family === "custom") return "maxres";
    if (parsed.family === "sd") return "sd";
    if (parsed.family === "mq") return "mq";
    return "hq"; // hqdefault / default
  }

  /* 產生第 frame 幀的網址：maxres2、hq2、oar2 … */
  function buildUrl(id, family, frame) {
    var f = frame === 1 || frame === 3 ? String(frame) : "2";
    var fam = VALID_FAMILY[family] ? family : "hq";
    return "https://i.ytimg.com/vi/" + id + "/" + fam + f + ".jpg";
  }

  /* 依序嘗試：想要的大小 → 480 → 原圖（直式只試 oar，再回原圖） */
  function chain(parsed, settings) {
    var family = targetFamily(parsed, settings);
    var list = [buildUrl(parsed.id, family, normalizeSettings(settings).frame)];
    if (parsed.kind !== "vertical") list.push(buildUrl(parsed.id, "hq", normalizeSettings(settings).frame));
    list.push(parsed.original);

    var out = [];
    for (var i = 0; i < list.length; i++) if (out.indexOf(list[i]) === -1) out.push(list[i]);
    return out;
  }

  function keyFor(parsed, settings) {
    var s = normalizeSettings(settings);
    return [parsed.id, parsed.family, s.quality, s.frame].join("|");
  }

  var API = {
    DEFAULTS: DEFAULTS,
    normalizeSettings: normalizeSettings,
    parseThumb: parseThumb,
    buildUrl: buildUrl,
    targetFamily: targetFamily,
    chain: chain,
    keyFor: keyFor
  };

  root.YTSM = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
