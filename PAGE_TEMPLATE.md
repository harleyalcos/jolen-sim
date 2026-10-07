# Awakening Page Template & Page Builder Guide

You can add new awakening pages (e.g. Page 6 to 17) in two ways:
1. **Interactive Visual Page Builder** (Recommended & Easiest): Click the `🛠️ PAGE BUILDER` button in the app header!
2. **Code Definition in `src/pagesData.ts`**: Paste a `PageDefinition` directly into `RAW_PAGES`.

---

## ⚡ Option 1: Using the In-App Page Builder (Fastest)

1. Open the calculator in your browser.
2. Click **`🛠️ PAGE BUILDER`** in the top navigation bar.
3. **Set Thresholds**: Paste your threshold numbers into the text box (e.g. `32 48 56 64 71 ... 179`). They are parsed and sorted automatically, setting the max goal!
4. **Place Cells**: Click on any ghost hex on the board to place a cell using the active brush (Sword ⚔️, Shield 🛡️, Drop 💧 and 1★ to 6★).
   - **Bilateral Mirror Mode** is enabled by default, so placing a cell on the left wing automatically mirrors it to the right wing!
   - Toggle **Sunburst Center** for ornate golden-framed cells.
5. **Test or Export**:
   - Click **`💾 SAVE & TEST IN APP`** to immediately load and simulate the new page inside the calculator!
   - Click **`📋 COPY CODE`** to copy the formatted TypeScript definition whenever you want to permanently add it to `src/pagesData.ts`.

---

## Option 2: Manual Code Workflow for New Pages

When adding Page $N$:
1. **Define Page Object** in [`src/pagesData.ts`](file:///Users/harleyalcos/Documents/CSBS/awakening-calculator/src/pagesData.ts) and add it to `RAW_PAGES`.
2. **Export Goal** in [`src/planner.ts`](file:///Users/harleyalcos/Documents/CSBS/awakening-calculator/src/planner.ts) (`export const PAGE_SIX_GOAL = ...`).
3. **Add Test** in [`tests/planner.test.mjs`](file:///Users/harleyalcos/Documents/CSBS/awakening-calculator/tests/planner.test.mjs) and verify with `npm test`.

---

## 2. Page Definition Blueprint Template

Copy and paste this snippet into [`src/pagesData.ts`](file:///Users/harleyalcos/Documents/CSBS/awakening-calculator/src/pagesData.ts):

```ts
export const PAGE_SIX_DEF: PageDefinition = {
  page: 6,
  goalStars: 120, // Max threshold value from user list
  defaultSelectedCellId: 'D', // Optional: defaults to first sunburst center cell or 'A'
  storageKey: 'awakening_p6_board', // Optional: defaults to `awakening_p${page}_board`
  cells: [
    // Row 0 (y = 250)
    { id: 'A', x: 835, y: 250, kind: 'drop' },
    { id: 'B', x: 961, y: 250, kind: 'sword' },

    // Row 1 (y = 360)
    { id: 'C', x: 772, y: 360, kind: 'drop' },
    { id: 'D', x: 898, y: 360, kind: 'sword', isCenter: true },
    { id: 'E', x: 1023, y: 360, kind: 'drop' },

    // ... additional cells labeled 'A' through 'Z'
  ],
  thresholds: [
    { level: 25, effects: [{ name: 'Awakening Milestone', value: '25★' }] },
    { level: 89, effects: [{ name: 'Basic Attack', value: '5' }] },
    // ...
    { level: 119, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 120, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};
```

Then append it to `RAW_PAGES`:
```ts
export const RAW_PAGES: PageDefinition[] = [
  PAGE_ONE_DEF,
  PAGE_TWO_DEF,
  PAGE_THREE_DEF,
  PAGE_FOUR_DEF,
  PAGE_FIVE_DEF,
  PAGE_SIX_DEF, // <-- Add here
];
```

---

## 3. Hex Grid Coordinate Reference

The background hex canvas uses standard staggered hexagonal spacing:
- **Row height increment ($\Delta y$)**: `110px`
- **Horizontal spacing ($\Delta x$)**: `~125.5px` (offset by `~63px` between adjacent rows)

| Row Index | Y Position | Valid Hex X Coordinates |
| :--- | :--- | :--- |
| **Row 0** | `y: 250` | `459, 584, 710, 835, 961, 1086, 1212, 1337` |
| **Row 1** | `y: 360` | `521, 647, 772, 898, 1023, 1149, 1274, 1400` |
| **Row 2** | `y: 470` | `459, 584, 710, 835, 961, 1086, 1212, 1337` |
| **Row 3** | `y: 580` | `521, 647, 772, 898, 1023, 1149, 1274, 1400` |
| **Row 4** | `y: 690` | `459, 584, 710, 835, 961, 1086, 1212, 1337` |
| **Row 5** | `y: 800` | `521, 647, 772, 898, 1023, 1149, 1274, 1400` |
| **Row 6** | `y: 910` | `459, 584, 710, 835, 961, 1086, 1212, 1337` |
| **Row 7** | `y: 1020` | `521, 647, 772, 898, 1023, 1149, 1274, 1400` |

---

## 4. Star Level Colors & Icons Cheat Sheet

### Star Colors (In-Game Backgrounds):
- **1★**: Teal / Slate (`#5c8a92`)
- **2★**: Emerald Green (`#45a172`)
- **3★**: Ocean Blue (`#3572ad`)
- **4★**: Maroon / Wine Red (`#b85958`)
- **5★**: Royal Purple (`#8b63a6`)
- **6★**: Radiant Gold / Amber (`#caa043`)

### Icon Kinds:
- `'sword'`: Crossed swords icon
- `'shield'`: Crest shield icon
- `'drop'`: Water / Anima droplet icon
- `isCenter: true`: Ornate golden sunburst border (rerolling touching cells)

---

## 5. Verification Checksum
Always verify:
$$\sum (\text{defaultStar of all cells}) = \text{Overall Awakening Level on screenshot}$$
This guarantees 100% accuracy on every cell definition before running tests.
