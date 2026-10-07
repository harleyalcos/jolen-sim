import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './pageBuilder.css';
import {
  type CellDef,
  type Kind,
  type PageDefinition,
  type Threshold,
  RAW_PAGES,
  getEffectiveRawPages,
  autoAssignCellIds,
  parseThresholdsInput,
  generateTypeScriptCode,
  saveCustomPage,
  PAGE_SIX_DRAFT,
} from './pagesData';

function getInitialPageState(pageNum: number) {
  const all = getEffectiveRawPages();
  const found = all.find((p) => p.page === pageNum);
  if (found) {
    return {
      goalStars: found.goalStars,
      cells: found.cells,
      thresholdsRaw: found.thresholds.map((t) => t.level).join(' '),
    };
  }
  return {
    goalStars: 100,
    cells: [] as CellDef[],
    thresholdsRaw: '',
  };
}

const STAR_COLORS: Record<number, string> = {
  0: '#3a3d45',
  1: '#5c8a92',
  2: '#45a172',
  3: '#3572ad',
  4: '#b85958',
  5: '#8b63a6',
  6: '#caa043',
};

const STAR_NAMES: Record<number, string> = {
  0: '0★ Empty',
  1: '1★ Teal',
  2: '2★ Green',
  3: '3★ Blue',
  4: '4★ Red',
  5: '5★ Purple',
  6: '6★ Gold',
};

function hex(x: number, y: number, radius = 68) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180;
    return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
}

function Icon({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  if (kind === 'sword') {
    return (
      <g transform={`translate(${x} ${y})`} className="cell-icon">
        <path d="M-22-25 22 19 M22-25-22 19 M-27-20-18-29 M18-29 27-20 M-27 20-18 29 M18 29 27 20" />
      </g>
    );
  }
  if (kind === 'shield') {
    return (
      <g transform={`translate(${x} ${y})`} className="cell-icon">
        <path d="M0-27 24-17 20 8Q12 24 0 30Q-12 24-20 8L-24-17Z" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`} className="cell-icon">
      <path d="M0-31C-8-14-21-4-21 10a21 21 0 0 0 42 0C21-4 8-14 0-31Z" />
      <path d="M0-11v29 M-9 6H9" />
    </g>
  );
}

function SunburstRays({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="sunburst-rays">
      <circle r="46" fill="none" stroke="#e8c262" strokeWidth="1.5" opacity="0.6" strokeDasharray="3 3" />
      {Array.from({ length: 12 }, (_, i) => {
        const deg = i * 30;
        const rad = (deg * Math.PI) / 180;
        const innerR = 48;
        const outerR = i % 2 === 0 ? 64 : 56;
        const x1 = Math.cos(rad) * innerR;
        const y1 = Math.sin(rad) * innerR;
        const x2 = Math.cos(rad) * outerR;
        const y2 = Math.sin(rad) * outerR;
        return (
          <line
            key={i}
            x1={x1.toFixed(1)}
            y1={y1.toFixed(1)}
            x2={x2.toFixed(1)}
            y2={y2.toFixed(1)}
            stroke="#e8c262"
            strokeWidth={i % 2 === 0 ? '2' : '1.2'}
            strokeLinecap="round"
            opacity={i % 2 === 0 ? '0.85' : '0.5'}
          />
        );
      })}
    </g>
  );
}

// Canonical grid positions (Rows 0 to 7)
function generateAllHexPositions() {
  const positions: { x: number; y: number; row: number; col: number }[] = [];
  for (let row = 0; row <= 7; row++) {
    const y = 250 + row * 110;
    const isOdd = row % 2 === 1;
    const startX = isOdd ? 395.5 : 333;
    for (let col = 0; col <= 9; col++) {
      const x = Math.round(startX + col * 125.5);
      positions.push({ x, y, row, col });
    }
  }
  return positions;
}

const ALL_HEX_POSITIONS = generateAllHexPositions();

function getMirroredCoord(x: number, y: number): { x: number; y: number } | null {
  const center = 898;
  if (Math.abs(x - center) < 10) return null; // Center axis
  const targetX = center + (center - x);
  const row = Math.round((y - 250) / 110);
  const isOdd = Math.abs(row) % 2 === 1;
  const startX = isOdd ? 395.5 : 333;

  let bestX = Math.round(targetX);
  let bestDist = Infinity;
  for (let c = 0; c <= 10; c++) {
    const candidateX = Math.round(startX + c * 125.5);
    const dist = Math.abs(candidateX - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = candidateX;
    }
  }
  return { x: bestX, y };
}

export function PageBuilder({
  initialPage = 6,
  onClose,
  onSavePage,
}: {
  initialPage?: number;
  onClose: () => void;
  onSavePage: (savedDef: PageDefinition) => void;
}) {
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [goalStars, setGoalStars] = useState(() => getInitialPageState(initialPage).goalStars);
  const [cells, setCells] = useState<CellDef[]>(() => getInitialPageState(initialPage).cells);
  const [thresholdsRaw, setThresholdsRaw] = useState(() => getInitialPageState(initialPage).thresholdsRaw);

  // Sync state whenever initialPage prop changes
  useEffect(() => {
    setPageNumber(initialPage);
    const initial = getInitialPageState(initialPage);
    setGoalStars(initial.goalStars);
    setCells(initial.cells);
    setThresholdsRaw(initial.thresholdsRaw);
    setSelectedCellId(null);
  }, [initialPage]);

  // Brush settings
  const [brushKind, setBrushKind] = useState<Kind>('sword');
  const [brushStar, setBrushStar] = useState<number>(0);
  const [brushIsCenter, setBrushIsCenter] = useState<boolean>(false);
  const [mirrorMode, setMirrorMode] = useState<boolean>(true);
  const [toolMode, setToolMode] = useState<'paint' | 'erase'>('paint');

  // Selection
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [hoveredHex, setHoveredHex] = useState<{ x: number; y: number } | null>(null);

  // Modals & Feedback
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const parsedThresholds: Threshold[] = useMemo(() => {
    return parseThresholdsInput(thresholdsRaw);
  }, [thresholdsRaw]);

  const maxPossibleStars = cells.length * 6;

  // Sync goalStars with max threshold if available, or cell count max if blank
  useEffect(() => {
    if (parsedThresholds.length > 0) {
      const maxVal = parsedThresholds[parsedThresholds.length - 1].level;
      setGoalStars(maxVal);
    } else if (cells.length > 0) {
      setGoalStars(cells.length * 6);
    }
  }, [parsedThresholds]);

  // Keep goalStars updated as cells are placed if no custom thresholds exist
  useEffect(() => {
    if (parsedThresholds.length === 0 && cells.length > 0) {
      setGoalStars(cells.length * 6);
    }
  }, [cells.length, parsedThresholds.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Cell Map for fast lookup
  const cellMap = useMemo(() => {
    const map = new Map<string, CellDef>();
    for (const c of cells) {
      map.set(`${c.x},${c.y}`, c);
    }
    return map;
  }, [cells]);

  const selectedCell = useMemo(() => {
    return cells.find((c) => c.id === selectedCellId) ?? null;
  }, [cells, selectedCellId]);

  // Mirrored coordinate of hovered hex
  const mirroredHoverHex = useMemo(() => {
    if (!mirrorMode || !hoveredHex) return null;
    return getMirroredCoord(hoveredHex.x, hoveredHex.y);
  }, [mirrorMode, hoveredHex]);

  // Handle click on a hex (empty or occupied)
  const handleHexClick = (x: number, y: number) => {
    const existing = cellMap.get(`${x},${y}`);

    if (toolMode === 'erase') {
      if (!existing) return;
      let newCells = cells.filter((c) => c.id !== existing.id);
      if (mirrorMode) {
        const mirror = getMirroredCoord(x, y);
        if (mirror) {
          const mirrorExisting = cellMap.get(`${mirror.x},${mirror.y}`);
          if (mirrorExisting) {
            newCells = newCells.filter((c) => c.id !== mirrorExisting.id);
          }
        }
      }
      setCells(autoAssignCellIds(newCells));
      if (selectedCellId === existing.id) setSelectedCellId(null);
      return;
    }

    // Paint / Place mode
    if (existing) {
      // Select cell for inspection
      setSelectedCellId(existing.id);
      return;
    }

    // Place new cell(s)
    const newCell: CellDef = {
      id: 'TEMP',
      x,
      y,
      kind: brushKind,
      defaultStar: brushStar,
      ...(brushIsCenter ? { isCenter: true } : {}),
    };

    const additions: CellDef[] = [newCell];

    if (mirrorMode) {
      const mirror = getMirroredCoord(x, y);
      if (mirror && !cellMap.has(`${mirror.x},${mirror.y}`)) {
        additions.push({
          id: 'TEMP_M',
          x: mirror.x,
          y: mirror.y,
          kind: brushKind,
          defaultStar: brushStar,
          ...(brushIsCenter ? { isCenter: true } : {}),
        });
      }
    }

    const updated = autoAssignCellIds([...cells, ...additions]);
    setCells(updated);
    setSelectedCellId(null);
  };

  const handleUpdateSelectedCell = (updates: Partial<CellDef>) => {
    if (!selectedCell) return;
    setCells((prev) =>
      prev.map((c) => (c.id === selectedCell.id ? { ...c, ...updates } : c)),
    );
  };

  const handleDeleteSelectedCell = useCallback(() => {
    if (!selectedCell) return;
    setCells((prev) => autoAssignCellIds(prev.filter((c) => c.id !== selectedCell.id)));
    setSelectedCellId(null);
  }, [selectedCell]);

  // Handler to change the kind of the currently selected cell (never mirrors, never affects placement brush)
  const handleChangeSelectedCellKind = useCallback(
    (targetKind: Kind) => {
      if (!selectedCell) return;

      const kindLabel =
        targetKind === 'sword'
          ? '⚔️ Sword'
          : targetKind === 'shield'
            ? '🛡️ Shield'
            : '💧 Water';

      // Update strictly the selected cell. Never mirror to other cells. Never alter brushKind.
      setCells((prev) =>
        prev.map((c) => (c.id === selectedCell.id ? { ...c, kind: targetKind } : c)),
      );

      showToast(`Cell ${selectedCell.id} set to ${kindLabel}`);
    },
    [selectedCell],
  );

  // Keybind listener for 1 (sword), 2 (shield), 3 (water) - strictly for selected cell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in input, textarea, or select
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      // Ignore modifier combinations (Ctrl, Cmd/Meta, Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Keybinds only work when a placed cell is selected (after putting cells in)
      if (!selectedCell) {
        return;
      }

      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        handleChangeSelectedCellKind('sword');
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        handleChangeSelectedCellKind('shield');
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        handleChangeSelectedCellKind('drop');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCellId) {
        e.preventDefault();
        handleDeleteSelectedCell();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell, selectedCellId, handleChangeSelectedCellKind, handleDeleteSelectedCell]);

  const handleAutoLetter = () => {
    setCells((prev) => autoAssignCellIds(prev));
    showToast('Re-lettered all cell IDs (A, B, C...)');
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all cells from the builder board?')) {
      setCells([]);
      setSelectedCellId(null);
    }
  };

  const handleStartBlankPage = (targetNum?: number) => {
    const all = getEffectiveRawPages();
    const highest = all.length > 0 ? Math.max(...all.map((p) => p.page)) : 6;
    const nextNum = targetNum ?? highest + 1;
    setPageNumber(nextNum);
    setGoalStars(100);
    setCells([]);
    setSelectedCellId(null);
    setThresholdsRaw('');
    showToast(`Started new blank Page ${nextNum}! Click hexes to build.`);
  };

  const handleLoadPage = (pageNum: number) => {
    const all = getEffectiveRawPages();
    const found = all.find((p) => p.page === pageNum);
    if (!found) {
      showToast(`Page ${pageNum} template not found.`);
      return;
    }

    setPageNumber(found.page);
    setGoalStars(found.goalStars);
    setCells(found.cells);
    setThresholdsRaw(found.thresholds.map((t) => t.level).join(' '));
    setSelectedCellId(null);
    showToast(`Loaded Page ${pageNum} template`);
  };

  const currentDefinition: PageDefinition = useMemo(() => {
    const defCenter = cells.find((c) => c.isCenter)?.id ?? cells[0]?.id ?? 'A';
    const finalGoal = goalStars > 0 ? goalStars : (cells.length * 6);
    const finalThresholds =
      parsedThresholds.length > 0
        ? parsedThresholds
        : [
            {
              level: finalGoal,
              effects: [{ name: 'Maximum Obtainable', value: `${finalGoal}★ (All 6★)` }],
            },
          ];

    return {
      page: pageNumber,
      goalStars: finalGoal,
      defaultSelectedCellId: defCenter,
      storageKey: `awakening_p${pageNumber}_board`,
      cells,
      thresholds: finalThresholds,
    };
  }, [pageNumber, goalStars, cells, parsedThresholds]);

  const generatedCode = useMemo(() => {
    return generateTypeScriptCode(currentDefinition);
  }, [currentDefinition]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      showToast('Copied TypeScript code to clipboard!');
    } catch {
      showToast('Please copy code manually from the View Code dialog.');
    }
  };

  const handleSaveAndTest = () => {
    if (cells.length === 0) {
      showToast('⚠️ Please place at least one cell on the board before saving!');
      return;
    }
    saveCustomPage(currentDefinition);
    onSavePage(currentDefinition);
    showToast(
      parsedThresholds.length > 0
        ? `Saved Page ${pageNumber}! Ready to test in calculator.`
        : `Saved Page ${pageNumber}! (Goal: ${currentDefinition.goalStars}★ max from ${cells.length} cells)`,
    );
  };

  // SVG ViewBox
  const ys = cells.map((c) => c.y);
  const minY = ys.length ? Math.min(250, ...ys) : 250;
  const maxY = ys.length ? Math.max(1020, ...ys) : 1020;
  const viewBoxHeight = maxY - minY + 300;
  const viewBoxY = minY - 150;
  const viewBoxWidth = 1460;
  const viewBoxX = 168; // Centered around x = 898

  return (
    <div className="builder-overlay" role="dialog" aria-modal="true" aria-label="Awakening Page Builder">
      {/* Toast Alert */}
      {toastMessage && <div className="builder-toast">{toastMessage}</div>}

      <div className="builder-modal">
        {/* Top Header */}
        <header className="builder-header">
          <div className="builder-title-group">
            <span className="builder-icon">🛠️</span>
            <div>
              <h2 className="builder-title">AWAKENING PAGE BUILDER</h2>
              <div className="builder-subtitle">Design custom hex boards & thresholds · Select cell to set kind with [1] Sword, [2] Shield, [3] Water</div>
            </div>
          </div>

          <div className="builder-header-actions">
            <button
              type="button"
              className="builder-btn btn-new-page"
              onClick={() => handleStartBlankPage()}
              title="Start a new blank page from scratch"
            >
              ➕ NEW BLANK PAGE
            </button>
            <button
              type="button"
              className="builder-btn btn-secondary"
              onClick={() => setShowCodeModal(true)}
              title="View TypeScript Code"
            >
              👁️ VIEW CODE
            </button>
            <button
              type="button"
              className="builder-btn btn-secondary"
              onClick={handleCopyCode}
              title="Copy code to clipboard"
            >
              📋 COPY CODE
            </button>
            <button
              type="button"
              className="builder-btn btn-primary"
              onClick={handleSaveAndTest}
              title="Save to app and test live"
            >
              💾 SAVE & TEST IN APP
            </button>
            <button
              type="button"
              className="builder-close-btn"
              onClick={onClose}
              aria-label="Close builder"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Builder Workspace Layout */}
        <div className="builder-workspace">
          {/* Main Left: Interactive Hex Grid */}
          <div className="builder-board-panel">
            {/* Top Toolbar */}
            <div className="builder-toolbar">
              <div className="toolbar-group">
                <span className="group-label">TOOL:</span>
                <button
                  type="button"
                  className={`tool-btn ${toolMode === 'paint' ? 'active' : ''}`}
                  onClick={() => setToolMode('paint')}
                >
                  🖌️ Place
                </button>
                <button
                  type="button"
                  className={`tool-btn ${toolMode === 'erase' ? 'active' : ''}`}
                  onClick={() => setToolMode('erase')}
                >
                  🧹 Erase
                </button>
              </div>

              <div className="toolbar-sep" />

              <div className="toolbar-group">
                <span className="group-label">BRUSH KIND:</span>
                {(['sword', 'shield', 'drop'] as Kind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`tool-btn ${brushKind === kind && toolMode === 'paint' ? 'active' : ''}`}
                    onClick={() => {
                      setBrushKind(kind);
                      setToolMode('paint');
                    }}
                  >
                    {kind === 'sword' ? '⚔️ Sword' : kind === 'shield' ? '🛡️ Shield' : '💧 Water'}
                  </button>
                ))}
              </div>

              <div className="toolbar-sep" />

              <div className="toolbar-group">
                <span className="group-label">DEFAULT STAR:</span>
                {[0, 1, 2, 3, 4, 5, 6].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-pill-btn ${brushStar === star && toolMode === 'paint' ? 'active' : ''}`}
                    style={{ '--star-color': STAR_COLORS[star] } as React.CSSProperties}
                    onClick={() => {
                      setBrushStar(star);
                      setToolMode('paint');
                    }}
                    title={STAR_NAMES[star]}
                  >
                    {star}★
                  </button>
                ))}
              </div>

              <div className="toolbar-sep" />

              <label className="checkbox-toggle" title="Ornate golden center starburst frame">
                <input
                  type="checkbox"
                  checked={brushIsCenter}
                  onChange={(e) => setBrushIsCenter(e.target.checked)}
                />
                <span className="checkbox-custom" />
                <span>🌟 Sunburst Center</span>
              </label>

              <label className="checkbox-toggle" title="Automatically mirror placed cells across vertical axis X = 898">
                <input
                  type="checkbox"
                  checked={mirrorMode}
                  onChange={(e) => setMirrorMode(e.target.checked)}
                />
                <span className="checkbox-custom" />
                <span>🪞 Bilateral Mirror Mode</span>
              </label>
            </div>

            {/* SVG Hex Board Canvas */}
            <div className="builder-canvas-wrapper">
              <svg
                className="builder-svg"
                viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
                role="img"
                aria-label="Interactive Hex Grid Editor"
                onMouseLeave={() => setHoveredHex(null)}
              >
                {/* Center Symmetry Guideline */}
                <line
                  x1="898"
                  y1={viewBoxY - 50}
                  x2="898"
                  y2={viewBoxY + viewBoxHeight + 50}
                  stroke="#ffaa00"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  opacity="0.3"
                />

                {/* All Ghost Hexagons */}
                {ALL_HEX_POSITIONS.map(({ x, y }) => {
                  const isOccupied = cellMap.has(`${x},${y}`);
                  const isHovered = hoveredHex?.x === x && hoveredHex?.y === y;
                  const isMirroredHover =
                    mirroredHoverHex?.x === x && mirroredHoverHex?.y === y;

                  return (
                    <polygon
                      key={`ghost-${x}-${y}`}
                      points={hex(x, y)}
                      className={`builder-ghost-cell ${isOccupied ? 'is-occupied' : ''} ${
                        isHovered ? 'is-hovered' : ''
                      } ${isMirroredHover ? 'is-mirrored-hover' : ''}`}
                      onMouseEnter={() => setHoveredHex({ x, y })}
                      onClick={() => handleHexClick(x, y)}
                    />
                  );
                })}

                {/* Placed Active Cells */}
                {cells.map((cell) => {
                  const isSelected = selectedCellId === cell.id;
                  const color = STAR_COLORS[cell.defaultStar ?? 0] ?? '#555';

                  return (
                    <g
                      key={`placed-${cell.id}`}
                      className={`builder-cell ${isSelected ? 'is-selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHexClick(cell.x, cell.y);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // Right-click deletes cell
                        setCells((prev) => autoAssignCellIds(prev.filter((c) => c.id !== cell.id)));
                        if (selectedCellId === cell.id) setSelectedCellId(null);
                      }}
                      style={{ cursor: toolMode === 'erase' ? 'crosshair' : 'pointer' }}
                    >
                      {/* Sunburst Rays */}
                      {cell.isCenter && <SunburstRays x={cell.x} y={cell.y} />}

                      {/* Main Hex Body */}
                      <polygon
                        points={hex(cell.x, cell.y, 66)}
                        fill="#12131a"
                        stroke={color}
                        strokeWidth={cell.isCenter ? '3.5' : '2'}
                      />

                      {/* Background Color Fill */}
                      <polygon
                        points={hex(cell.x, cell.y, 60)}
                        fill={color}
                        opacity="0.28"
                      />

                      {/* Inner Rim */}
                      <polygon
                        points={hex(cell.x, cell.y, 54)}
                        fill="none"
                        stroke={cell.isCenter ? '#f6d582' : color}
                        strokeWidth="1.2"
                        opacity="0.75"
                      />

                      {/* Icon */}
                      <Icon kind={cell.kind} x={cell.x} y={cell.y} />

                      {/* Cell ID Badge */}
                      <text
                        x={cell.x}
                        y={cell.y + 28}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="13"
                        fontWeight="700"
                        letterSpacing="0.05em"
                        opacity="0.9"
                      >
                        {cell.id}
                      </text>

                      {/* Default Star Indicator */}
                      <text
                        x={cell.x}
                        y={cell.y - 24}
                        textAnchor="middle"
                        fill={color}
                        fontSize="11"
                        fontWeight="700"
                      >
                        {cell.defaultStar ?? 0}★
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Bottom Canvas Status Bar */}
              <div className="canvas-status-bar">
                <span>{cells.length} Cells Placed</span>
                <span className="sep">·</span>
                <span>
                  Center Axis: X = 898px {mirrorMode && '· Mirror Mode: ON'}
                </span>
                <span className="sep">·</span>
                <span className="keybind-tips">
                  Click cell to select · Hotkeys: <kbd className="status-kbd">1</kbd> ⚔️ Sword · <kbd className="status-kbd">2</kbd> 🛡️ Shield · <kbd className="status-kbd">3</kbd> 💧 Water
                </span>
                <span className="sep">·</span>
                <span>Right-click to delete</span>
              </div>
            </div>

            {/* Board Quick Utilities Footer */}
            <div className="builder-board-footer">
              <div className="footer-left">
                <button
                  type="button"
                  className="util-btn"
                  onClick={handleAutoLetter}
                  title="Sort cells by row/col and re-letter 'A'..'Z'"
                >
                  🔤 Auto-Letter IDs
                </button>
                <button
                  type="button"
                  className="util-btn danger"
                  onClick={handleClearAll}
                  title="Clear all cells"
                >
                  🗑️ Clear Board
                </button>
              </div>

              <div className="footer-right">
                <span className="preset-label">TEMPLATES:</span>
                {getEffectiveRawPages().map((p) => (
                  <button
                    key={p.page}
                    type="button"
                    className={`preset-btn ${pageNumber === p.page ? 'highlight' : ''}`}
                    onClick={() => handleLoadPage(p.page)}
                    title={`Load Page ${p.page} layout`}
                  >
                    P{p.page}
                  </button>
                ))}
                <button
                  type="button"
                  className="preset-btn new-page-btn"
                  onClick={() => handleStartBlankPage()}
                  title="Create a new blank page from scratch"
                >
                  ➕ Blank Page
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Thresholds & Inspector */}
          <aside className="builder-sidebar">
            {/* Page Metadata Card */}
            <div className="builder-card">
              <div className="card-header">
                <span className="card-title">PAGE SETTINGS</span>
              </div>
              <div className="card-body form-grid">
                <label className="form-field">
                  <span className="field-label">PAGE NUMBER:</span>
                  <input
                    type="number"
                    min="1"
                    max="17"
                    className="builder-input"
                    value={pageNumber}
                    onChange={(e) => setPageNumber(parseInt(e.target.value, 10) || 1)}
                  />
                </label>
                <label className="form-field">
                  <span className="field-label">GOAL STARS (★):</span>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    className="builder-input"
                    value={goalStars}
                    onChange={(e) => setGoalStars(parseInt(e.target.value, 10) || 0)}
                  />
                </label>
              </div>

              <div className="max-stars-helper-box">
                <div className="helper-left">
                  <span className="helper-label">CELL COUNT MAXIMUM:</span>
                  <strong className="helper-number">{maxPossibleStars}★</strong>
                  <span className="helper-detail">({cells.length} cells × 6★)</span>
                </div>
                <button
                  type="button"
                  className="btn-use-cell-max"
                  onClick={() => {
                    setGoalStars(maxPossibleStars);
                    showToast(`Goal set to cell count maximum: ${maxPossibleStars}★`);
                  }}
                  title="Set page goal to maximum possible stars obtainable from cell count"
                >
                  🎯 SET MAX ({maxPossibleStars}★)
                </button>
              </div>
            </div>

            {/* Selected Cell Inspector Card */}
            <div className={`builder-card inspector-card ${selectedCell ? 'has-selection' : ''}`}>
              <div className="card-header">
                <span className="card-title">
                  {selectedCell ? `INSPECTOR: CELL ${selectedCell.id}` : 'CELL INSPECTOR'}
                </span>
                {selectedCell && (
                  <button
                    type="button"
                    className="btn-delete-cell"
                    onClick={handleDeleteSelectedCell}
                    title="Delete cell"
                  >
                    DELETE
                  </button>
                )}
              </div>

              <div className="card-body">
                {selectedCell ? (
                  <div className="inspector-fields">
                    <div className="field-row">
                      <label className="form-field">
                        <span className="field-label">CELL ID:</span>
                        <input
                          type="text"
                          className="builder-input"
                          value={selectedCell.id}
                          onChange={(e) => handleUpdateSelectedCell({ id: e.target.value.toUpperCase() })}
                          maxLength={3}
                        />
                      </label>
                      <div className="form-field">
                        <span className="field-label">POSITION (X, Y):</span>
                        <div className="coord-badge">{selectedCell.x}, {selectedCell.y}</div>
                      </div>
                    </div>

                    <div className="form-field">
                      <div className="field-label-row">
                        <span className="field-label">KIND:</span>
                        <span className="field-keybind-hint">Hotkeys: [1] Sword · [2] Shield · [3] Water</span>
                      </div>
                      <div className="kind-button-group">
                        {(['sword', 'shield', 'drop'] as Kind[]).map((k) => {
                          const keyNum = k === 'sword' ? '1' : k === 'shield' ? '2' : '3';
                          const label = k === 'sword' ? '⚔️ Sword' : k === 'shield' ? '🛡️ Shield' : '💧 Water';
                          return (
                            <button
                              key={k}
                              type="button"
                              className={`kind-select-btn ${selectedCell.kind === k ? 'selected' : ''}`}
                              onClick={() => handleChangeSelectedCellKind(k)}
                              title={`Set Cell ${selectedCell.id} to ${label} (Keybind: Press ${keyNum})`}
                            >
                              <span className="keybind-badge">{keyNum}</span>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-field">
                      <span className="field-label">DEFAULT STAR:</span>
                      <div className="star-button-group">
                        {[0, 1, 2, 3, 4, 5, 6].map((st) => (
                          <button
                            key={st}
                            type="button"
                            className={`star-select-btn ${(selectedCell.defaultStar ?? 0) === st ? 'selected' : ''}`}
                            style={{ '--star-color': STAR_COLORS[st] } as React.CSSProperties}
                            onClick={() => handleUpdateSelectedCell({ defaultStar: st })}
                          >
                            {st}★
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="checkbox-toggle">
                      <input
                        type="checkbox"
                        checked={!!selectedCell.isCenter}
                        onChange={(e) => handleUpdateSelectedCell({ isCenter: e.target.checked })}
                      />
                      <span className="checkbox-custom" />
                      <span>🌟 Ornate Center Sunburst</span>
                    </label>
                  </div>
                ) : (
                  <div className="inspector-empty-hint">
                    Click any cell on the board to inspect and edit its ID, icon type, or star level.
                  </div>
                )}
              </div>
            </div>

            {/* Thresholds Input Card */}
            <div className="builder-card thresholds-card">
              <div className="card-header">
                <span className="card-title">THRESHOLDS & MILESTONES</span>
                <span className="card-badge">{parsedThresholds.length} LEVELS</span>
              </div>

              <div className="card-body">
                {parsedThresholds.length === 0 && (
                  <div className="thresholds-empty-notice">
                    <span className="notice-icon">🔒</span>
                    <div>
                      <strong>Milestones not unlocked in-game?</strong>
                      <p>You can leave this blank! The goal will automatically be set to the <strong>maximum possible stars ({maxPossibleStars}★)</strong> from your {cells.length} cells.</p>
                    </div>
                  </div>
                )}

                <p className="field-hint">
                  Paste threshold level numbers (separated by spaces, commas, or newlines):
                </p>
                <textarea
                  className="builder-textarea"
                  rows={4}
                  value={thresholdsRaw}
                  onChange={(e) => setThresholdsRaw(e.target.value)}
                  placeholder="e.g. 32 48 56 64 71 78 84 90 95 100 ... 179"
                />

                <div className="threshold-actions-bar">
                  <button
                    type="button"
                    className="threshold-action-btn"
                    onClick={() => {
                      setGoalStars(maxPossibleStars);
                      setThresholdsRaw(String(maxPossibleStars));
                      showToast(`Set threshold to cell count maximum (${maxPossibleStars}★)`);
                    }}
                    title="Set threshold milestone to cell count maximum"
                  >
                    ⭐ Use Cell Count Max ({maxPossibleStars}★)
                  </button>
                  {thresholdsRaw && (
                    <button
                      type="button"
                      className="threshold-action-btn clear"
                      onClick={() => setThresholdsRaw('')}
                      title="Clear threshold input to use cell count max"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="threshold-summary-row">
                  <span>Parsed: <strong>{parsedThresholds.length}</strong> milestones</span>
                  <span>Goal: <strong style={{ color: '#ffaa00' }}>{goalStars}★</strong></span>
                </div>

                {/* Chips of parsed thresholds */}
                <div className="thresholds-chip-list">
                  {parsedThresholds.map((t, idx) => (
                    <span
                      key={t.level}
                      className={`threshold-chip ${idx === parsedThresholds.length - 1 ? 'is-max' : ''}`}
                      title={idx === parsedThresholds.length - 1 ? 'Max Goal' : `Milestone Level ${t.level}`}
                    >
                      {t.level}★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Code Preview Modal */}
      {showCodeModal && (
        <div className="code-modal-backdrop" onClick={() => setShowCodeModal(false)}>
          <div className="code-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="code-modal-header">
              <h3>TYPESCRIPT PAGE DEFINITION</h3>
              <div className="code-modal-actions">
                <button type="button" className="builder-btn btn-primary" onClick={handleCopyCode}>
                  📋 COPY CODE
                </button>
                <button type="button" className="builder-close-btn" onClick={() => setShowCodeModal(false)}>
                  ✕
                </button>
              </div>
            </div>
            <pre className="code-modal-pre">
              <code>{generatedCode}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
