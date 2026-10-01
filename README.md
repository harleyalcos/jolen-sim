# Awakening Calculator

A local page 1 prototype for **Architect: Land of Exiles**. Select a cell and set its stars to match your in-game board; the advisor then suggests the next cell for reaching the page's 80★ milestone. Right-click a cell for quick editing. **Simulate Tap** is optional and rolls the calculator board locally.

The advisor estimates the remaining cost of each possible tap using 10,000 simulated runs per cell. Page 1 charges 1 Anima Element and 1,000 gold per affected cell. It minimizes estimated Anima, which also minimizes estimated gold. Close estimates are flagged in the UI. The simulation uses a simple continuation strategy, so its recommendation is not a proof of the mathematically optimal path.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually <http://localhost:5173/>. Run `npm test` and `npm run build` to check the app.
