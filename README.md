# MidThumb

**YouTube thumbnails, taken from the middle of the video.**

A tiny Manifest V3 extension for Chromium browsers (Chrome, Edge, Doubao Browser) that swaps each video's cover image for the frame YouTube captured halfway through playback. Covers are marketing; the middle frame is what the video actually looks like.

> Built end-to-end with **DeepSeek Harness (DSH)** — design, code, tests and docs were produced in a DSH session, then verified with the tests below.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and pick the `extension/` folder
4. Open YouTube and reload the page

The toolbar popup has an on/off switch, quality and frame picker. Turning it off restores YouTube's original thumbnails immediately, no reload needed.

## How it works

YouTube stores three auto-captured frames per video, named `1`, `2`, `3` — `2` is the middle. The page itself shows a cover (`hqdefault.jpg`, `hq720.jpg`, …). MidThumb just rewrites the image URL; it never touches the player, never downloads video, and never intercepts requests.

| Thumbnail on the page | Becomes | Size |
| --- | --- | --- |
| `hqdefault.jpg` | `hq2.jpg` | 480×360 |
| `sddefault.jpg` | `sd2.jpg` | 640×480 |
| `hq720.jpg`, `maxresdefault.jpg` | `maxres2.jpg` | 1280×720 |
| `mqdefault.jpg`, `default.jpg` | `mq2.jpg` / `hq2.jpg` | 320×180 |
| `oardefault.jpg` (Shorts, vertical) | `oar2.jpg` | 1080×1920 |

If a frame does not exist, the image falls back to `hq2.jpg` and then to the original cover, so a missing thumbnail never becomes a broken image.

## Settings

| Setting | Options |
| --- | --- |
| Enable | on / off |
| Quality | Auto (matches the original size), 480×360, 640×480, 1280×720, 320×180 |
| Frame | first (25%), middle (50%), last (75%) |

## Limits

- The three frames are fixed at 25 / 50 / 75% — you cannot ask for "12:34".
- Live streams (`*_live.jpg`) are skipped; they have no frame trio.
- 480 and 640 frames are 4:3 with black bars; CSS `object-fit: cover` crops them to 16:9.
- Works on `*.youtube.com`. If YouTube ships a new thumbnail shape, unknown names are left untouched.

## Development

Requires Node 18+.

```bash
node --test test/        # 23 tests: URL logic + fake-DOM lifecycle
node tools/check.mjs     # manifest references and icon sizes
python tools/make-icons.py   # regenerate icons (needs Pillow)
```

Only `storage` is requested. No network permissions, no content injection outside YouTube.

## 中文

把 YouTube 的影片封面換成「影片播到中段」那一格畫面的瀏覽器擴充功能。首頁、搜尋結果、推薦列與 Shorts 都適用；抓不到中段畫面時會自動退回原本的封面。本專案的程式由 **DeepSeek Harness（DSH）** 協助撰寫。

## License

MIT
