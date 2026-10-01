# Awakening Calculator — development handoff

Updated 2026-09-27. This file summarizes the conversation and the current workspace for continuing the project in Antigravity. The user's newest request in that new conversation should take precedence over older ideas recorded here.

## Current direction

The user wants a **small local prototype**, developed **one requested change at a time**. The latest instruction was to strip the app back to **only the first awakening page's board**. The user explicitly felt the earlier UI and screenshot-reading approach were too complicated. The current screen therefore has a title, `PAGE 01 / 17`, and a visual board. It has no active controls, calculator result, scanner, or simulator UI. Wait for the user to choose the next feature before adding one.

The app name is **Awakening Calculator**. It runs locally with `npm run dev`; there is no hosting, account system, backend, telemetry, reporting workflow, or log collection requested. The user said a small group would eventually use it but wants to see it work locally first. They will handle any reports themselves.

## Current workspace

- Project: `/Users/harleyalcos/Documents/CSBS/awakening-calculator`
- Stack: React 19, TypeScript, Vite 6; `npm install` then `npm run dev` (usually `http://localhost:5173/`).
- The directory is **not a Git repository** as checked on 2026-09-27.
- `src/App.tsx`: the active, static page 1 SVG. Sixteen occupied hex cells were manually mapped from the user's page 1 screenshot. Their icon types and colors reflect that screenshot. The colors are a snapshot, not editable saved progress. The SVG is an approximation, not a pixel-perfect tracing of game art.
- `src/styles.css`: very small black board layout with thin rules and an orange page indicator.
- `index.html` and `README.md`: current page 1 prototype description.
- `src/engine.ts`, `src/screenshot.ts`, and `tests/engine.test.mjs`: **leftover code from the earlier page 2 calculator/scanner**. The current `App.tsx` does not import them. `npm test` covers that old engine, not the current page 1 view. Do not mistake their API or assumptions for an approved current feature.
- The 48-star `SAMPLE_BOARD` in that old engine is invented demonstration data, not a transcription of the user's board. Its optimizer ranked only the next tap under the independent-roll assumption; it did not solve a multi-tap or minimum-Anima strategy.
- `npm run build` and `npm test` passed after the page 1 simplification. The test suite passing does not validate page 1 geometry.

## Screenshot and design references

These local files were available when this handoff was written:

| Reference | Path | What it shows |
| --- | --- | --- |
| **Page 1 game screenshot** | `/Users/harleyalcos/Downloads/Screenshot 2026-09-27 at 2.47.42 AM.png` | The source for the current 16-cell board. It shows `1 / 17`; the right panel shows a selected normal cell with 4 stars. Original image is 2556 × 1179. |
| Page 3 full screenshot | `/Users/harleyalcos/Desktop/Screenshot 2026-09-27 at 2.39.57 AM.png` | Shows `3 / 17`, a different and larger occupied-cell layout, and Overall Awakening Level 63. |
| Page 3 crop | `/Users/harleyalcos/Desktop/Screenshot 2026-09-27 at 2.39.53 AM.png` | Closer view of the page 3 board. |
| UI style reference | `/Users/harleyalcos/Desktop/Screenshot 2026-09-27 at 2.18.04 AM.png` | A black instrument-style interface with hairline dividers, orange signals, compact white text, and mono metrics. |
| User's USB monitor app | `/Users/harleyalcos/Documents/CSBS/usb-monitor` | The user also liked its square controls and technical, compact layout. Its `src/app/globals.css` is a more reliable style reference than its possibly stale `DESIGN_SYSTEM.md`. |

Older page 2 screenshots were supplied through temporary clipboard paths in earlier turns; those temporary files were no longer present when checked. The page 1 and page 3 files above are persistent local references.
The user had trouble pasting a screenshot into Codex, so checking the named local file was how the page 1 reference was recovered.

## What the user established about the game

- Game: **Architect: Land of Exiles**, awakening system with 17 pages shown in the screenshots.
- A cell has 1–6 stars; 6 is the maximum. Its color indicates the star tier. The small decorative dots beneath an icon are **not** the star count.
- Activating a cell rerolls that cell and directly touching occupied cells. The user said the same cell can be activated repeatedly and even a 6-star neighbor can drop.
- The user's original aim was to reach **65 Overall Awakening Level/stars** efficiently. A screenshot later showed level 63. **The relationship between the game's Overall Awakening Level and the sum of cells on one page has not been verified.** An earlier prototype treated a page sum as the target; verify that model before restoring calculations.
- The user once said a reroll cannot retain its current star level. An official game guide was later interpreted as allowing the same star. This is an **unresolved rule conflict**; do not silently choose one model for a future recommendation.
- The previously researched [official Architect probability table](https://architectgb.drimage.com/en/info/probability?subKey=AWAKENING&type=15) was recorded in the old engine as 1★ 41%, 2★ 20%, 3★ 17%, 4★ 10%, 5★ 9%, 6★ 3%. If odds return to the UI, the user wanted a small link to that source. The old engine assumes affected cells roll independently; joint-roll behavior and the Anima cost formula were not verified.
- An [official game guide](https://architectgb.drimage.com/en/info/guide?bpIdx=6251) was also consulted earlier about selected and adjacent cells. Recheck its wording if resolving the reroll-rule conflict above.
- Page layouts differ. Page 2 was modeled as 13 cells in the old engine. The actual page 3 screenshot visibly has more occupied cells. Page 1 has 16 occupied cells in the supplied reference.

## Product decisions and course correction

1. Earlier, the user wanted players to enter their real board progress and optionally play that board in a simulator. This was for a broader calculator concept and is **deferred by the later simplification request**.
2. The user strongly disliked setting each cell manually. They considered a preset prompt for Gemini/ChatGPT to turn a screenshot into copyable JSON, then discussed faster ways to input a board. This is background exploration, **not a current instruction to build AI import**.
3. A direct browser image reader was implemented for page 2. It aligned a fixed 13-cell pattern and classified hues. Generated test boards worked, but the actual page 3 screenshot placed those 13 markers incorrectly and produced a false 47-star reading. This demonstrated that a page 2 template cannot safely parse another page. The user rejected this approach as too complicated. The scanner code remains dormant in `src/screenshot.ts` and is not exposed in the current UI.
4. A previous full dashboard also had real/simulator tabs, next-tap advice, odds, and many panels. The user said the tabs were unclear and the UI had too much on it. Those panels and tabs were removed from the active app.
5. The user then supplied the page 1 screenshot, and the current static SVG board was mapped from it. The latest working style is intentionally spare: black canvas, light rules, orange page indicator, colored hexes, and game-like icons. The user said they will specify additions **one by one**.

The user accepted several recommendations during an earlier grilling discussion, but the exact text of every recommendation is not present in this handoff. The explicit decisions above and the user's later request for a bare page 1 UI are the actionable context.

## What to do next

Start from the **current page 1 board** and the user's next specific instruction. Keep each iteration narrow and visible. If adding a calculation later, first settle how Overall Awakening Level is computed, whether rerolls can repeat the same star, and how page-specific geometry and adjacency should be represented. If adding screenshot input later, use real game screenshots as pass/fail fixtures; the old fixed page 2 detector was proven unsafe on page 3.
