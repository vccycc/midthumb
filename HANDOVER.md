# HANDOVER — MidThumb

最後更新：2026-11-06 ｜ 版本 **1.2.0** ｜ <https://github.com/vccycc/midthumb>

在另一台電腦接手這個專案時，照這份做即可。目標是 10 分鐘內能改程式、跑測試、把擴充功能載進瀏覽器。

## 1. 新電腦上線（10 分鐘）

```bash
# 1) Node 18 以上
node -v

# 2) 取得程式
git clone https://github.com/vccycc/midthumb.git
cd midthumb

# 3) 跑測試，應該是 23 passed
node --test test/
node tools/check.mjs

# 4) 載入瀏覽器（Chrome / Edge / 豆包）
#    chrome://extensions → 開發人員模式 → 載入未封裝 → 選這個資料夾裡的 extension/
```

載入後開 YouTube，點工具列圖示，面板副標要顯示 **v1.2.0**。沒有版本號或顯示舊版，就是沒重新載入。

要能推程式碼，另外準備其一：`gh auth login`（GitHub CLI），或把 remote 改成 SSH。

## 2. 專案地圖

| 檔案 | 職責 |
| --- | --- |
| `extension/manifest.json` | MV3 設定；只申請 `storage`，沒有網路權限 |
| `extension/thumb-core.js` | 純邏輯：認出主縮圖、組出第 N 幀網址、降級鏈。不碰 DOM，最容易單元測試 |
| `extension/content.js` | 內容腳本：監看 DOM、換 `img.src`、失敗回退、開關還原 |
| `extension/content.css` | 讓 4:3 的幀用 `object-fit: cover` 填滿 16:9 |
| `extension/popup.*` | 面板（同時註冊成 options_ui，可整頁開啟） |
| `test/core.test.mjs` | 網址邏輯 15 項 |
| `test/dom-smoke.mjs` | 假 DOM 流程 8 項（換圖、回退、停用還原、srcset） |
| `tools/check.mjs` | 檢查 manifest 引用與圖示尺寸 |
| `tools/make-icons.py` | Pillow 重畫圖示（需要 `pip install pillow`） |

## 3. 它到底怎麼運作

YouTube 對每支影片自動截三張畫面，檔名結尾 `1`、`2`、`3`，`2` 是中段。擴充功能只把頁面上的封面網址換成同一支影片的第 2 幀，**不下載影片、不改播放器、不攔截請求**。

| 頁面上的封面 | 換成 | 尺寸 |
| --- | --- | --- |
| `hqdefault.jpg` | `hq2.jpg` | 480×360 |
| `sddefault.jpg` | `sd2.jpg` | 640×480 |
| `hq720.jpg`、`maxresdefault.jpg` | `maxres2.jpg` | 1280×720 |
| `mqdefault.jpg`、`default.jpg` | `mq2.jpg` / `hq2.jpg` | 320×180 |
| `oardefault.jpg`（Shorts 直式） | `oar2.jpg` | 1080×1920 |

「畫質＝自動」會依原圖大小選目標；指定的尺寸不存在時退回 `hq2`，再不行回原圖，所以不會出現破圖。

## 4. 走過的三個坑（很可能再遇到）

1. **面板只顯示標題、沒有畫質選項**：某些 Chromium 分支會把 popup 高度算成只有 header。已用 `min-height` 修掉，並註冊 `options_ui`（擴充功能詳細資料 → 擴充功能選項）可整頁開同一份介面。
2. **搜尋頁只有第一張縮圖被換**：該頁多數卡片用 `hq720.jpg`，1.1 只認 `*default` 所以漏掉。1.2.0 已支援 `hq720`、`oardefault` 與自訂封面 A/B 版（`hq720_custom_2`）。
3. **縮圖全空白、YouTube 說「你沒有連線」**：那是 `i.ytimg.com` 被 DNS 污染，不是外掛。判準：Console 裡 `i.ytimg.com/generate_204` 也是 `ERR_CONNECTION_TIMED_OUT`。解法是瀏覽器開安全 DNS（`https://dns.google/dns-query`），或讓代理放行 `*.ytimg.com`、`*.googlevideo.com`。

## 5. 已知限制

- 三張幀固定 25% / 50% / 75%，**不能指定秒數**。要精準秒數得走 storyboard（`playerResponse.storyboard`），但 spec 帶簽章、圖片有 CORS，容易整批失效——評估過，暫時不做。
- 直播（`*_live.jpg`）沒有幀，直接跳過。
- Shorts 的畫質選項無效（只有 `oar1/2/3` 一種尺寸）。
- 播放清單頁、社群貼文等若用別的檔名（例如 `frame0.jpg`），目前維持原圖。
- 依賴 YouTube 的 DOM 與檔名規則，改版就可能失效；失效時通常是「什麼都沒換」，不會壞頁面。

## 6. 下一步（優先序）

1. README 放實際截圖（首頁前後對照），說服力最高。
2. 擴大版位涵蓋：先抓目標頁面 HTML 統計 `i.ytimg.com/vi/<id>/<檔名>` 出現哪些檔名，再決定要不要加進 `classify()`。
3. 上架 Chrome Web Store：需要 zip、商店文案、隱私說明（只申請 `storage`，不收集資料）。
4. 進階：storyboard 精準取幀（見上）。

## 7. 開發慣例

- 改 `thumb-core.js` 一定要補 `test/core.test.mjs`；改生命週期就補 `dom-smoke.mjs`。
- 版本號三處同步：`manifest.json`、`popup.html` 的版本文字、`package.json`。
- commit 訊息一句話講清楚改了什麼（例：`支援 hq720 與 Shorts 縮圖`）。
- 面板與程式都只有繁中與英文，沒有 build step，改完直接重載擴充功能。

## 8. 相關連結

- 中文完整說明（知識庫）：mkz repo 的 `02-成品庫/2026/2026-11-03-豆包瀏覽器-YouTube中段縮圖外掛/README.md`
- 知識庫工作規則：同 repo 的 `AGENTS.md`
