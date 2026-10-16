# Rabbit Hole

**Browser history is a list. Curiosity is a path.**

Rabbit Hole is a Chrome extension that follows one curiosity trail at a time (the tab you start in, plus the tabs that open from it), draws it as a map, and writes a reading of what came back across trails. It started as a question: curiosity leaves no record, so what if it could?

Status: personal project, prototype. Capture, the map and a code-made report work. An optional Claude step that names threads across trails is not built yet.

## Try it

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select the `extension/` folder.
3. Pin the icon. Run a search, open the side panel, and choose **Start a trail here**. **Surface** when you are done.
4. Open **the book** for the map and **Read my week** for the report.

After changing code, press the reload arrow on the extension card. Chrome does not pick up edits on its own.

## What it keeps, and what it does not

- Follows only the trail you start. Nothing else in the browser is read.
- Keeps page titles, addresses without tracking parameters, search terms (on search pages only), and time on page.
- Skips banking, email and password sites by default (editable in the book).
- Stores everything in the browser (`chrome.storage.local`). Nothing is sent anywhere. The extension requests no site access.

## How it is organised

```
extension/
  manifest.json      Manifest V3. Permissions: tabs, webNavigation, storage, unlimitedStorage, sidePanel, alarms, idle
  background.js      Capture engine: lineage, time on page, trail lifecycle
  common.js          Shared helpers: URL scrubbing, skip list, titles
  analyze.js         The code-made report: counts, sittings, returning words, loose ends (pure functions)
  panel.*            Side panel: start, pause, surface
  book.*             The map and settings
  report.*           The reading page
  art.js, *.css      Botanical drawings and the romantic-academia theme (fonts bundled locally)
tests/
  run.py, run2.py    Real-Chromium checks of capture (Playwright, headless)
  analyze-check.js   Prints what the report layer finds in an export
```

## Principles

- **Count in code, interpret with Claude.** Every number comes from plain code you can check. A Claude step, when built, only names themes and asks questions, and each claim must point at the stops behind it.
- **A reading is a hypothesis.** The tool does not know what mattered to you. It infers from time on page, and you decide what is right.
- **Complete without an account.** The code-made report stands alone. Claude is an optional upgrade, and using what Claude already knows about you should be an explicit choice, not the default.

## Tests

```
pip install playwright && playwright install chromium
python3 tests/run.py      # lineage, skip list, pause, surface
python3 tests/run2.py     # returns, SPA titles, junk titles
node tests/analyze-check.js path/to/your-export.json
```

## Your data

Exports from the book are your browsing history. They are ignored by `.gitignore`, and should not be committed or posted.

## Known limits

- Only trails you start are recorded. Many real trails begin on a page, not a search, so passive capture is the next design question.
- Titles and search words only, never page text.
- A few days of data gives repeats, not habits.
