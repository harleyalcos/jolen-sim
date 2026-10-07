import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import './styles.css';
import {
  planNextTap,
  sumDistribution,
  EXPECTED_STAR,
  GOLD_PER_CELL,
  STAR_PROBABILITIES,
  type PlanResult,
} from './planner';
import {
  type Kind,
  type CellDef,
  type Threshold,
  type ProcessedPageConfig,
  type PageDefinition,
  PAGES,
  PAGES_BY_NUM,
  RAW_PAGES,
  MIN_PAGE,
  MAX_PAGE,
  TOTAL_PAGES_IN_GAME,
  getNeighbors,
  getEffectivePages,
  getEffectiveRawPages,
  saveCustomPage,
  deleteCustomPage,
} from './pagesData';
import { PageBuilder } from './PageBuilder';

const STARS = [1, 2, 3, 4, 5, 6] as const;

function rollStar(): number {
  const roll = Math.random();
  let cumulative = 0;
  for (const star of STARS) {
    cumulative += STAR_PROBABILITIES[star];
    if (roll < cumulative) return star;
  }
  return 6;
}

const STAR_COLORS: Record<number, string> = {
  0: '#555869',
  1: '#5c8a92',
  2: '#45a172',
  3: '#3572ad',
  4: '#b85958',
  5: '#8b63a6',
  6: '#caa043',
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

function makeSectorPath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startDeg: number,
  endDeg: number,
  gapDeg = 0.8,
) {
  const a1 = ((startDeg + gapDeg) * Math.PI) / 180;
  const a2 = ((endDeg - gapDeg) * Math.PI) / 180;

  const p1x = cx + rIn * Math.cos(a1);
  const p1y = cy + rIn * Math.sin(a1);
  const p2x = cx + rOut * Math.cos(a1);
  const p2y = cy + rOut * Math.sin(a1);
  const p3x = cx + rOut * Math.cos(a2);
  const p3y = cy + rOut * Math.sin(a2);
  const p4x = cx + rIn * Math.cos(a2);
  const p4y = cy + rIn * Math.sin(a2);

  return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${p2x.toFixed(1)} ${p2y.toFixed(1)} A ${rOut} ${rOut} 0 0 1 ${p3x.toFixed(1)} ${p3y.toFixed(1)} L ${p4x.toFixed(1)} ${p4y.toFixed(1)} A ${rIn} ${rIn} 0 0 0 ${p1x.toFixed(1)} ${p1y.toFixed(1)} Z`;
}

function Board({
  cells,
  board,
  selectedCellId,
  affectedNeighbors,
  animatingIds,
  bestMoveId,
  hoveredCellId,
  onSelectCell,
  onSetCellStar,
  onHoverCell,
}: {
  cells: CellDef[];
  board: Record<string, number>;
  selectedCellId: string;
  affectedNeighbors: string[];
  animatingIds: string[];
  bestMoveId?: string;
  hoveredCellId?: string | null;
  onSelectCell: (id: string) => void;
  onSetCellStar: (id: string, star: number) => void;
  onHoverCell?: (id: string | null) => void;
}) {
  const [radialPickerCellId, setRadialPickerCellId] = useState<string | null>(null);

  useEffect(() => {
    if (!radialPickerCellId) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = (e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement) as Element | null;
      if (target?.closest?.('.radial-sector-item') || target?.closest?.('.radial-clear-btn')) {
        return;
      }
      setRadialPickerCellId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRadialPickerCellId(null);
      }
    };

    const handleBlur = () => {
      setRadialPickerCellId(null);
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown, true);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('blur', handleBlur);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [radialPickerCellId]);

  const ys = useMemo(() => cells.map((c) => c.y), [cells]);
  const minY = ys.length ? Math.min(...ys) : 250;
  const maxY = ys.length ? Math.max(...ys) : 910;
  const centerY = Math.round((minY + maxY) / 2);
  const viewBoxHeight = Math.max(960, maxY - minY + 340);
  const viewBoxY = Math.round(centerY - viewBoxHeight / 2);
  const xs = useMemo(() => cells.map((c) => c.x), [cells]);
  const minX = xs.length ? Math.min(...xs) : 646;
  const maxX = xs.length ? Math.max(...xs) : 1274;
  const centerX = Math.round((minX + maxX) / 2);
  const viewBoxWidth = 1370;
  const viewBoxX = Math.round(centerX - viewBoxWidth / 2);

  const ghost = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => {
      const row = i - 3; // -3 to 11 (covers y = -80 to 1460)
      const y = 250 + row * 110;
      const isOdd = Math.abs(row) % 2 === 1;
      const startX = isOdd ? 395.5 : 333;
      return Array.from({ length: 11 }, (_, col) => ({ x: startX + col * 125.5, y }));
    })
      .flat()
      .filter(({ x, y }) => !cells.some((cell) => Math.hypot(cell.x - x, cell.y - y) < 4));
  }, [cells]);

  return (
    <svg
      className="board-svg"
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Awakening hex board with occupied cells"
      onMouseLeave={() => onHoverCell?.(null)}
    >
      {ghost.map(({ x, y }) => (
        <polygon key={`${x}-${y}`} points={hex(x, y)} className="ghost-cell" />
      ))}
      {cells.map((cell) => {
        const star = board[cell.id] ?? cell.defaultStar ?? 0;
        const isSelected = cell.id === selectedCellId;
        const isNeighbor = affectedNeighbors.includes(cell.id) && !isSelected;
        const isAnimating = animatingIds.includes(cell.id);
        const isBestMove = cell.id === bestMoveId;
        const isRadialOpen = cell.id === radialPickerCellId;
        const isHovered = cell.id === hoveredCellId;

        return (
          <g
            key={cell.id}
            className={`active-cell star-${star} ${isSelected ? 'selected' : ''} ${isNeighbor ? 'neighbor-target' : ''} ${isAnimating ? 'pulse-awaken' : ''} ${isBestMove ? 'is-best-move' : ''} ${isRadialOpen ? 'has-radial-open' : ''} ${isHovered ? 'is-hovered' : ''}`}
            onMouseEnter={() => onHoverCell?.(cell.id)}
            onMouseLeave={() => onHoverCell?.(null)}
            onClick={() => {
              if (radialPickerCellId) {
                setRadialPickerCellId(null);
              }
              onSelectCell(cell.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelectCell(cell.id);
              setRadialPickerCellId(cell.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Cell ${cell.id}: ${star === 0 ? 'Empty (0 stars)' : `${star} stars`}, ${cell.kind}. Right-click to set star level.`}
          >
            <title>{`Cell ${cell.id}: ${star === 0 ? 'Empty (0 stars)' : `${star} stars`} (${cell.kind})${isBestMove ? ' — Recommended Move' : ''} · Right-click to set star level`}</title>

            {isSelected && (
              <polygon points={hex(cell.x, cell.y, 71)} className="selected-outer" />
            )}

            {isNeighbor && (
              <polygon
                key={`neighbor-${selectedCellId}-${cell.id}`}
                points={hex(cell.x, cell.y, 71)}
                className="breathing-neighbor-outline"
              />
            )}

            <polygon points={hex(cell.x, cell.y)} className="active-outer" />
            <polygon points={hex(cell.x, cell.y, 61)} className="active-inner" />

            {/* In-Game Center Node Sunburst Aura */}
            {cell.isCenter && !isRadialOpen && (
              <g className="center-sunburst" transform={`translate(${cell.x} ${cell.y})`}>
                {Array.from({ length: 12 }, (_, i) => {
                  const rad = ((i * 30) * Math.PI) / 180;
                  const r1 = 28;
                  const r2 = i % 2 === 0 ? 44 : 36;
                  return (
                    <line
                      key={i}
                      x1={(Math.cos(rad) * r1).toFixed(1)}
                      y1={(Math.sin(rad) * r1).toFixed(1)}
                      x2={(Math.cos(rad) * r2).toFixed(1)}
                      y2={(Math.sin(rad) * r2).toFixed(1)}
                      stroke="#caa043"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                  );
                })}
                <circle r="30" fill="none" stroke="#caa043" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
              </g>
            )}

            {!isRadialOpen && <Icon kind={cell.kind} x={cell.x} y={cell.y} />}

            {!isRadialOpen && (
              <text x={cell.x} y={cell.y + 44} className="cell-id-tag">
                {cell.id}
              </text>
            )}

            {/* Best Move Badge overlay */}
            {isBestMove && !radialPickerCellId && (
              <g transform={`translate(${cell.x} ${cell.y - 58})`} className="best-move-tag-group">
                <rect x="-26" y="-10" width="52" height="20" rx="3" className="best-move-tag-bg" />
                <text x="0" y="4" className="best-move-tag-text">★ TIP</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Segmented Arc Sector Picker Menu (Pie Wedges) */}
      {radialPickerCellId && (() => {
        const target = cells.find((c) => c.id === radialPickerCellId);
        if (!target) return null;
        const currentStar = board[target.id] ?? target.defaultStar ?? 0;
        const Rin = 76;
        const Rout = 150;
        const fanUp = target.y - Rout >= viewBoxY + 20;
        const baseDeg = fanUp ? 180 : 0;
        const sweepFlag = fanUp ? 1 : 0;

        return (
          <g className="half-radial-container" style={{ transformOrigin: `${target.x}px ${target.y}px` }}>
            {/* Outer subtle glow arc rim */}
            <path
              d={`M ${(target.x - Rout - 3).toFixed(1)} ${target.y.toFixed(1)} A ${Rout + 3} ${Rout + 3} 0 0 ${sweepFlag} ${(target.x + Rout + 3).toFixed(1)} ${target.y.toFixed(1)}`}
              className="radial-fan-outer-glow"
            />

            {/* 6 Large Sector Wedges (1★ to 6★) */}
            {STARS.map((star, idx) => {
              const startDeg = baseDeg + idx * 30;
              const endDeg = startDeg + 30;
              const midDeg = startDeg + 15;
              const midRad = (midDeg * Math.PI) / 180;
              const rMid = (Rin + Rout) / 2;
              const bx = target.x + rMid * Math.cos(midRad);
              const by = target.y + rMid * Math.sin(midRad);
              const isCurrent = currentStar === star;
              const color = STAR_COLORS[star];
              const sectorPath = makeSectorPath(target.x, target.y, Rin, Rout, startDeg, endDeg, 0.9);

              return (
                <g
                  key={star}
                  className={`radial-sector-item star-${star} ${isCurrent ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetCellStar(target.id, star);
                    setRadialPickerCellId(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetCellStar(target.id, star);
                    setRadialPickerCellId(null);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Set Cell ${target.id} to ${star} stars`}
                  style={{ '--tone': color } as React.CSSProperties}
                >
                  <title>{`Set Cell ${target.id} to ${star} stars`}</title>
                  <path d={sectorPath} className="radial-sector-path" />
                  <text
                    x={bx.toFixed(1)}
                    y={by.toFixed(1)}
                    className="sector-number-text"
                  >
                    {star}
                  </text>
                </g>
              );
            })}

            {/* Prominent Clear / Empty 0★ Button in Center of Hexagon */}
            <g
              transform={`translate(${target.x} ${target.y})`}
              className={`radial-clear-btn ${currentStar === 0 ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSetCellStar(target.id, 0);
                setRadialPickerCellId(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetCellStar(target.id, 0);
                setRadialPickerCellId(null);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Set Cell ${target.id} to empty (0 stars)`}
            >
              <title>{`Set Cell ${target.id} to Empty (0★)`}</title>
              <rect x="-48" y="-18" width="96" height="36" rx="6" className="radial-clear-bg" />
              <text x="0" y="4" className="radial-clear-text">
                ✕ EMPTY (0★)
              </text>
            </g>
          </g>
        );
      })()}
    </svg>
  );
}

function PageDropdown({
  currentPage,
  pages,
  onSelectPage,
  onAddNewPage,
  onOpenBuilder,
  onDeleteCustomPage,
}: {
  currentPage: number;
  pages: ProcessedPageConfig[];
  onSelectPage: (page: number) => void;
  onAddNewPage?: () => void;
  onOpenBuilder?: () => void;
  onDeleteCustomPage?: (pageNum: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeOption = pages.find((p) => p.page === currentPage) ?? pages[0];

  return (
    <div className="custom-page-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`dropdown-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select awakening page, currently Page ${currentPage}`}
      >
        <span className="trigger-badge">PAGE</span>
        <span className="trigger-num">{String(currentPage).padStart(2, '0')}</span>
        <span className="trigger-total">/ {TOTAL_PAGES_IN_GAME}</span>
        <span className="trigger-sep">|</span>
        <span className="trigger-nodes">{activeOption.nodeCount} NODES</span>
        <svg
          className={`trigger-chevron ${isOpen ? 'is-rotated' : ''}`}
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown-menu-popover" role="listbox" aria-label="Awakening Pages">
          <div className="dropdown-menu-header">
            <span className="dropdown-menu-title">SELECT AWAKENING PAGE</span>
            <span className="dropdown-menu-count">{pages.length} / {TOTAL_PAGES_IN_GAME} READY</span>
          </div>

          <div className="dropdown-options-list">
            {pages.map((opt) => {
              const isSelected = opt.page === currentPage;
              const isCustom = !RAW_PAGES.some((rp) => rp.page === opt.page);
              return (
                <div
                  key={opt.page}
                  className={`dropdown-option-item ${isSelected ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => {
                    onSelectPage(opt.page);
                    setIsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPage(opt.page);
                      setIsOpen(false);
                    }
                  }}
                >
                  <div className="option-badge-col">
                    <span className="option-num-badge">
                      {String(opt.page).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="option-info-col">
                    <div className="option-title-row">
                      <span className="option-name">{opt.label}</span>
                      {isCustom && <span className="option-status-tag custom">CUSTOM</span>}
                      {isSelected ? (
                        <span className="option-status-tag active">ACTIVE</span>
                      ) : (
                        <span className="option-status-tag ready">LOAD</span>
                      )}
                    </div>
                    <div className="option-meta-row">
                      <span className="meta-nodes">{opt.nodeCount} Nodes</span>
                      <span className="meta-dot">·</span>
                      <span className="meta-goal">{opt.goalStars}★ {opt.isMaxFromCellCount ? 'Max' : 'Goal'}</span>
                    </div>
                  </div>

                  <div className="option-check-col">
                    {isSelected && (
                      <span className="option-checkmark" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    {isCustom && onDeleteCustomPage && (
                      <button
                        type="button"
                        className="option-del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete custom Page ${opt.page}?`)) {
                            onDeleteCustomPage(opt.page);
                          }
                        }}
                        title="Delete custom page"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(onAddNewPage || onOpenBuilder) && (
            <div className="dropdown-menu-footer">
              {onAddNewPage && (
                <button
                  type="button"
                  className="dropdown-add-page-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNewPage();
                  }}
                >
                  ➕ Add New Page {pages.length < TOTAL_PAGES_IN_GAME ? `(Page ${pages[pages.length - 1].page + 1})` : ''}
                </button>
              )}
              {onOpenBuilder && (
                <button
                  type="button"
                  className="dropdown-builder-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenBuilder();
                  }}
                >
                  🛠️ Open Page Builder
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY_PAGE = 'awakening_current_page';
const STORAGE_KEY_AUTO = 'awakening_auto_mode';

export interface CellStats {
  cellId: string;
  affectedIds: string[];
  affectedSummary: { id: string; star: number }[];
  currentSum: number;
  gainChance: number;
  lossChance: number;
  sameChance: number;
  gainPercent: number;
  lossPercent: number;
  expectedDelta: number;
  count6: number;
  count5: number;
  lowCount: number;
}

function computeCellStats(
  cellId: string,
  cells: CellDef[],
  board: Record<string, number>,
  affected: number[][],
): CellStats | null {
  const cellIndex = cells.findIndex((c) => c.id === cellId);
  if (cellIndex === -1) return null;

  const affectedIndices = affected[cellIndex] ?? [cellIndex];
  const affectedCells = affectedIndices.map((i) => cells[i]);
  const affectedSummary = affectedCells.map((c) => ({
    id: c.id,
    star: board[c.id] ?? c.defaultStar ?? 0,
  }));

  const currentSum = affectedSummary.reduce((sum, c) => sum + c.star, 0);
  const cellCount = affectedIndices.length;

  const dist = sumDistribution(cellCount);
  const gainChance = dist.reduce((sum, p, roll) => sum + (roll > currentSum ? p : 0), 0);
  const lossChance = dist.reduce((sum, p, roll) => sum + (roll < currentSum ? p : 0), 0);
  const sameChance = dist.reduce((sum, p, roll) => sum + (roll === currentSum ? p : 0), 0);
  const expectedDelta = cellCount * EXPECTED_STAR - currentSum;

  const count6 = affectedSummary.filter((c) => c.star === 6).length;
  const count5 = affectedSummary.filter((c) => c.star === 5).length;
  const lowCount = affectedSummary.filter((c) => c.star <= 3).length;

  return {
    cellId,
    affectedIds: affectedSummary.map((c) => c.id),
    affectedSummary,
    currentSum,
    gainChance,
    lossChance,
    sameChance,
    gainPercent: Math.round(gainChance * 100),
    lossPercent: Math.round(lossChance * 100),
    expectedDelta,
    count6,
    count5,
    lowCount,
  };
}

function getComparisonInsight(
  compareStats: CellStats,
  tipStats: CellStats,
  tipCellId: string,
): string {
  if (compareStats.cellId === tipCellId) {
    return 'This is the recommended tip cell.';
  }

  const parts: string[] = [];

  const gainDiff = tipStats.gainPercent - compareStats.gainPercent;
  if (gainDiff > 0) {
    parts.push(`${gainDiff}% lower gain chance than Cell ${tipCellId}`);
  } else if (gainDiff < 0) {
    parts.push(`${Math.abs(gainDiff)}% higher gain chance`);
  }

  if (compareStats.count6 > tipStats.count6) {
    const riskDiff = compareStats.count6 - tipStats.count6;
    parts.push(`risks ${riskDiff} maxed 6★ node${riskDiff > 1 ? 's' : ''}`);
  }

  const deltaDiff = tipStats.expectedDelta - compareStats.expectedDelta;
  if (deltaDiff > 0.5) {
    parts.push(
      `lower expected yield (${compareStats.expectedDelta >= 0 ? '+' : ''}${compareStats.expectedDelta.toFixed(1)}★ vs ${tipStats.expectedDelta >= 0 ? '+' : ''}${tipStats.expectedDelta.toFixed(1)}★)`
    );
  }

  if (parts.length === 0) {
    return `Similar yield to Cell ${tipCellId}, but Cell ${tipCellId} provides better strategic positioning.`;
  }

  return `${parts.join(', ')}.`;
}
function getTipExplanation(
  bestIndex: number,
  cells: CellDef[],
  board: Record<string, number>,
  affected: number[][],
  goal: number,
  totalStars: number,
): ReactNode {
  const cell = cells[bestIndex];
  if (!cell) return null;

  const affectedIndices = affected[bestIndex] ?? [bestIndex];
  const affectedCells = affectedIndices.map((i) => cells[i]);
  const affectedStars = affectedCells.map((c) => ({
    id: c.id,
    star: board[c.id] ?? 0,
  }));

  const allBoardStars = cells.map((c) => board[c.id] ?? 0);
  const minStarOnBoard = Math.min(...allBoardStars);
  const count6OnBoard = allBoardStars.filter((s) => s === 6).length;

  const affected6 = affectedStars.filter((c) => c.star === 6);
  const affected5 = affectedStars.filter((c) => c.star === 5);
  const affectedBottlenecks = affectedStars.filter((c) => c.star <= Math.max(3, minStarOnBoard));

  const deficit = goal - totalStars;

  // Case 1: Striking distance
  if (deficit <= affectedIndices.length * (6 - minStarOnBoard) && deficit <= 6) {
    const safeMsg =
      affected6.length === 0 && count6OnBoard > 0
        ? ' while safely protecting all 6★ nodes.'
        : '.';
    return (
      <>
        Within striking distance (<strong>{deficit}★</strong> needed). Tapping{' '}
        <strong>Cell {cell.id}</strong> rerolls {affectedIndices.length} node
        {affectedIndices.length === 1 ? '' : 's'} to close the gap{safeMsg}
      </>
    );
  }

  // Case 2: Endgame (no cells below 5★)
  if (minStarOnBoard >= 5) {
    if (affected5.length > 0) {
      const fiveList = affected5.map((c) => `Cell ${c.id}`).join(', ');
      return (
        <>
          Targets <strong>{fiveList}</strong> (5★) to roll for 6★ upgrades{' '}
          {affected6.length === 0
            ? 'with zero risk to existing 6★ nodes.'
            : `with only ${affected6.length} 6★ node${affected6.length === 1 ? '' : 's'} at risk.`}
        </>
      );
    }
  }

  // Case 3: Bottleneck clearing
  const hitsLowest = affectedStars.some((c) => c.star === minStarOnBoard);
  const lowestList = affectedBottlenecks.map((c) => `${c.id} (${c.star}★)`).join(', ');

  const safety =
    affected6.length === 0 && count6OnBoard > 0
      ? ' while safely protecting all 6★ nodes.'
      : affected6.length > 0
      ? ` with minimal collateral risk (${affected6.length} 6★ affected).`
      : '.';

  return (
    <>
      {hitsLowest && affectedBottlenecks.length > 0 ? (
        <>
          Rerolls {affectedBottlenecks.length === 1 ? 'bottleneck node ' : 'low-star bottlenecks ('}
          <strong>{lowestList}</strong>
          {affectedBottlenecks.length === 1 ? '' : ')'}
        </>
      ) : affectedBottlenecks.length > 0 ? (
        <>
          Rerolls low nodes (<strong>{lowestList}</strong>) for expected star growth
        </>
      ) : (
        <>
          Rerolls <strong>{affectedIndices.length}</strong> nodes for maximum expected gain
        </>
      )}
      {safety}
    </>
  );
}

export default function App() {
  const [pagesVersion, setPagesVersion] = useState(0);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const pages = useMemo(() => getEffectivePages(), [pagesVersion]);
  const pagesByNum = useMemo(
    () => Object.fromEntries(pages.map((p) => [p.page, p])),
    [pages],
  );
  const minPage = pages[0]?.page ?? 1;
  const maxPage = pages[pages.length - 1]?.page ?? 6;

  const [builderInitialPage, setBuilderInitialPage] = useState<number>(() => {
    const effective = getEffectiveRawPages();
    return (effective[effective.length - 1]?.page ?? 6) + 1;
  });

  const handleAddNewPage = () => {
    const effective = getEffectiveRawPages();
    const nextNum = (effective[effective.length - 1]?.page ?? 6) + 1;
    setBuilderInitialPage(nextNum);
    setIsBuilderOpen(true);
  };

  const handleOpenBuilderForCurrentPage = () => {
    setBuilderInitialPage(currentPage);
    setIsBuilderOpen(true);
  };

  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAGE);
      if (saved) {
        const p = Number(saved);
        if (p >= MIN_PAGE && p <= MAX_PAGE) return p;
      }
    } catch {}
    return MAX_PAGE; // Default to highest unlocked page
  });

  const [autoMode, setAutoMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTO);
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  const [boards, setBoards] = useState<Record<number, Record<string, number>>>(() => {
    const ZEROED_STORAGE_KEY = 'awakening_boards_zeroed_v1';
    try {
      if (!localStorage.getItem(ZEROED_STORAGE_KEY)) {
        for (const p of PAGES) {
          localStorage.removeItem(p.storageKey);
        }
        localStorage.setItem(ZEROED_STORAGE_KEY, 'true');
      }
    } catch {}

    const initial: Record<number, Record<string, number>> = {};
    for (const p of PAGES) {
      let b = p.initialBoard;
      try {
        const saved = localStorage.getItem(p.storageKey);
        if (saved) b = JSON.parse(saved);
      } catch {}
      initial[p.page] = b;
    }
    return initial;
  });

  interface HistoryEntry {
    board: Record<string, number>;
    tapsAdded: number;
  }

  const [histories, setHistories] = useState<Record<number, HistoryEntry[]>>(() =>
    Object.fromEntries(PAGES.map((p) => [p.page, []])),
  );

  const [tapCounts, setTapCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(PAGES.map((p) => [p.page, 0])),
  );

  const [selectedCellIds, setSelectedCellIds] = useState<Record<number, string>>(() =>
    Object.fromEntries(PAGES.map((p) => [p.page, p.defaultSelectedCellId])),
  );

  const [animatingIds, setAnimatingIds] = useState<string[]>([]);
  const thresholdsListRef = useRef<HTMLDivElement>(null);

  // Active configurations based on current page from dynamic registry
  const pageConfig = pagesByNum[currentPage] ?? pages[0];
  const activeCells = pageConfig.cells;
  const activeThresholds = pageConfig.thresholds;
  const activeGoal = pageConfig.goalStars;
  const activeAffected = pageConfig.affected;

  const currentBoard = boards[currentPage] ?? pageConfig.initialBoard;
  const currentHistory = histories[currentPage] ?? [];
  const currentTapCount = tapCounts[currentPage] ?? 0;

  const handleResetTapCount = () => {
    setTapCounts((prev) => ({
      ...prev,
      [currentPage]: 0,
    }));
  };
  const selectedCellId = selectedCellIds[currentPage] ?? activeCells[0].id;

  const selectedDef = activeCells.find((cell) => cell.id === selectedCellId) ?? activeCells[0];
  const affectedNeighbors = getNeighbors(activeCells, selectedCellId);
  const totalStars = Object.values(currentBoard).reduce((sum, s) => sum + s, 0);
  const maxPossibleStars = activeCells.length * 6;

  // Current progress milestone: highest threshold <= totalStars
  const currentThreshold =
    [...activeThresholds].reverse().find((t) => totalStars >= t.level) ?? null;

  const nextThreshold = activeThresholds.find((t) => t.level > totalStars);
  const isMaxed = totalStars >= activeGoal;
  const boardKey = activeCells.map((cell) => currentBoard[cell.id] ?? 0).join(',');

  // Instant calculation via high-performance Monte Carlo engine (<20ms)
  const plan = useMemo(() => {
    if (isMaxed) return null;
    try {
      const boardArr = activeCells.map((cell) => currentBoard[cell.id] ?? 0);
      return planNextTap(boardArr, activeAffected, activeGoal, 100, 0x12345678);
    } catch {
      return null;
    }
  }, [boardKey, isMaxed, activeGoal, activeAffected, activeCells]);

  const bestMove = plan ? activeCells[plan.bestIndex] : null;

  const tipExplanation = useMemo(() => {
    if (!plan || isMaxed) return null;
    return getTipExplanation(
      plan.bestIndex,
      activeCells,
      currentBoard,
      activeAffected,
      activeGoal,
      totalStars,
    );
  }, [plan, isMaxed, activeCells, currentBoard, activeAffected, activeGoal, totalStars]);

  const tipStats = useMemo(() => {
    if (!bestMove) return null;
    return computeCellStats(bestMove.id, activeCells, currentBoard, activeAffected);
  }, [bestMove, activeCells, currentBoard, activeAffected]);

  const compareCellId = hoveredCellId ?? (selectedCellId !== bestMove?.id ? selectedCellId : null);
  const compareCell = compareCellId ? activeCells.find((c) => c.id === compareCellId) ?? null : null;
  const compareStats = useMemo(() => {
    if (!compareCell) return null;
    return computeCellStats(compareCell.id, activeCells, currentBoard, activeAffected);
  }, [compareCell, activeCells, currentBoard, activeAffected]);

  // Persist current page & boards & auto mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAGE, String(currentPage));
    } catch {}
  }, [currentPage]);

  useEffect(() => {
    try {
      for (const p of pages) {
        if (boards[p.page]) {
          localStorage.setItem(p.storageKey, JSON.stringify(boards[p.page]));
        }
      }
    } catch {}
  }, [boards, pages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO, String(autoMode));
    } catch {}
  }, [autoMode]);

  // Center scroll directly on current progress milestone
  const scrollToCurrent = (smooth = true) => {
    const container = thresholdsListRef.current;
    if (!container) return;
    if (!currentThreshold) {
      container.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    const targetEl = document.getElementById(`threshold-${currentThreshold.level}`);
    if (!targetEl) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top;
    const targetScroll =
      container.scrollTop + relativeTop - container.clientHeight / 2 + targetEl.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToCurrent(false);
    }, 40);
    return () => clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    scrollToCurrent(true);
  }, [totalStars, currentThreshold?.level]);

  type AutoSpeed = 1 | 3 | 5 | 10 | 'instant';

  const [isAutoSimulating, setIsAutoSimulating] = useState<boolean>(false);
  const isAutoSimulatingRef = useRef<boolean>(false);
  const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>(1);
  const autoSpeedRef = useRef<AutoSpeed>(1);
  const autoSimTimeoutRef = useRef<number | null>(null);
  const stopAutoSimulate = useCallback(() => {
    isAutoSimulatingRef.current = false;
    setIsAutoSimulating(false);
    if (autoSimTimeoutRef.current !== null) {
      clearTimeout(autoSimTimeoutRef.current);
      autoSimTimeoutRef.current = null;
    }
  }, []);

  const runInstantSimulation = () => {
    if (isMaxed) return;
    stopAutoSimulate();

    let tempBoard = { ...currentBoard };
    const newHistoryEntries: HistoryEntry[] = [];
    const maxTaps = 5000;
    let taps = 0;
    let lastTappedCellId: string | null = null;
    let lastAffectedIds: string[] = [];

    while (taps < maxTaps) {
      const currentTotal = Object.values(tempBoard).reduce((sum, s) => sum + s, 0);
      if (currentTotal >= activeGoal) break;

      const boardArr = activeCells.map((cell) => tempBoard[cell.id] ?? 0);
      let planResult: PlanResult | null = null;
      try {
        planResult = planNextTap(boardArr, activeAffected, activeGoal, 100, 0x12345678);
      } catch {
        break;
      }

      if (!planResult || !activeCells[planResult.bestIndex]) break;

      const tapCell = activeCells[planResult.bestIndex];
      lastTappedCellId = tapCell.id;
      lastAffectedIds = getNeighbors(activeCells, tapCell.id);

      newHistoryEntries.push({ board: tempBoard, tapsAdded: 1 });

      const nextBoard: Record<string, number> = { ...tempBoard };
      lastAffectedIds.forEach((id) => {
        nextBoard[id] = rollStar();
      });
      tempBoard = nextBoard;
      taps++;
    }

    setHistories((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), ...newHistoryEntries],
    }));
    setTapCounts((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? 0) + taps,
    }));
    setBoards((prev) => ({
      ...prev,
      [currentPage]: tempBoard,
    }));
    if (lastTappedCellId) {
      setSelectedCellIds((prev) => ({
        ...prev,
        [currentPage]: lastTappedCellId,
      }));
    }
    setAnimatingIds(lastAffectedIds);
    setTimeout(() => {
      setAnimatingIds([]);
    }, 300);
  };

  const handleSetAutoSpeed = (speed: AutoSpeed) => {
    setAutoSpeed(speed);
    autoSpeedRef.current = speed;
    if (speed === 'instant' && isAutoSimulatingRef.current) {
      runInstantSimulation();
    }
  };

  useEffect(() => {
    return () => {
      stopAutoSimulate();
    };
  }, [stopAutoSimulate]);

  // Page switcher
  const handlePageChange = (newPage: number) => {
    if (newPage < minPage || newPage > maxPage || newPage === currentPage) return;
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    }
    setCurrentPage(newPage);
    if (!boards[newPage]) {
      const cfg = pagesByNum[newPage];
      if (cfg) {
        let b = cfg.initialBoard;
        try {
          const saved = localStorage.getItem(cfg.storageKey);
          if (saved) b = JSON.parse(saved);
        } catch {}
        setBoards((prev) => ({ ...prev, [newPage]: b }));
      }
    }
    if (autoMode) {
      const targetConfig = pagesByNum[newPage];
      if (!targetConfig) return;
      const targetBoard = boards[newPage] ?? targetConfig.initialBoard;
      const total = Object.values(targetBoard).reduce((sum, s) => sum + s, 0);
      if (total < targetConfig.goalStars) {
        try {
          const bArr = targetConfig.cells.map((cell) => targetBoard[cell.id] ?? cell.defaultStar ?? 0);
          const p = planNextTap(bArr, targetConfig.affected, targetConfig.goalStars, 100, 0x12345678);
          if (p && targetConfig.cells[p.bestIndex]) {
            setSelectedCellIds((prev) => ({
              ...prev,
              [newPage]: targetConfig.cells[p.bestIndex].id,
            }));
          }
        } catch {}
      }
    }
  };

  const handleSaveCustomPage = (savedDef: PageDefinition) => {
    saveCustomPage(savedDef);
    setPagesVersion((v) => v + 1);
    setCurrentPage(savedDef.page);
    setBoards((prev) => ({
      ...prev,
      [savedDef.page]: Object.fromEntries(savedDef.cells.map((c) => [c.id, c.defaultStar ?? 0])),
    }));
    setSelectedCellIds((prev) => ({
      ...prev,
      [savedDef.page]:
        savedDef.defaultSelectedCellId ||
        (savedDef.cells.find((c) => c.isCenter)?.id ?? savedDef.cells[0]?.id ?? 'A'),
    }));
    setIsBuilderOpen(false);
  };

  const handleDeleteCustomPage = (pageNum: number) => {
    deleteCustomPage(pageNum);
    setPagesVersion((v) => v + 1);
    if (currentPage === pageNum) {
      setCurrentPage(1);
    }
  };

  // Board star editing functions
  const handleSetCellStar = (cellId: string, starVal: number) => {
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    }
    setHistories((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), { board: currentBoard, tapsAdded: 0 }],
    }));
    setBoards((prev) => ({
      ...prev,
      [currentPage]: {
        ...(prev[currentPage] ?? {}),
        [cellId]: Math.max(0, Math.min(6, starVal)),
      },
    }));
  };

  const handleAwaken = () => {
    const targets = getNeighbors(activeCells, selectedCellId);
    const nextBoard = { ...currentBoard };
    targets.forEach((id) => {
      nextBoard[id] = rollStar();
    });

    setHistories((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), { board: currentBoard, tapsAdded: 1 }],
    }));
    setTapCounts((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? 0) + 1,
    }));
    setBoards((prev) => ({
      ...prev,
      [currentPage]: nextBoard,
    }));
    setAnimatingIds(targets);

    setTimeout(() => {
      setAnimatingIds([]);
    }, 240);

    if (autoMode) {
      const nextTotal = Object.values(nextBoard).reduce((sum, s) => sum + s, 0);
      if (nextTotal < activeGoal) {
        try {
          const nextBoardArr = activeCells.map((cell) => nextBoard[cell.id] ?? 0);
          const nextPlan = planNextTap(nextBoardArr, activeAffected, activeGoal, 100, 0x12345678);
          if (nextPlan && activeCells[nextPlan.bestIndex]) {
            const nextBestId = activeCells[nextPlan.bestIndex].id;
            setSelectedCellIds((prev) => ({
              ...prev,
              [currentPage]: nextBestId,
            }));
          }
        } catch {}
      }
    }
  };

  const handleUndo = () => {
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    }
    if (currentHistory.length === 0) return;
    const previous = currentHistory[currentHistory.length - 1];
    setBoards((prev) => ({
      ...prev,
      [currentPage]: previous.board,
    }));
    setHistories((prev) => ({
      ...prev,
      [currentPage]: prev[currentPage].slice(0, -1),
    }));
    if (previous.tapsAdded) {
      setTapCounts((prev) => ({
        ...prev,
        [currentPage]: Math.max(0, (prev[currentPage] ?? 0) - previous.tapsAdded),
      }));
    }

    if (autoMode) {
      const prevTotal = Object.values(previous.board).reduce((sum, s) => sum + s, 0);
      if (prevTotal < activeGoal) {
        try {
          const prevBoardArr = activeCells.map((cell) => previous.board[cell.id] ?? 0);
          const prevPlan = planNextTap(prevBoardArr, activeAffected, activeGoal, 100, 0x12345678);
          if (prevPlan && activeCells[prevPlan.bestIndex]) {
            const prevBestId = activeCells[prevPlan.bestIndex].id;
            setSelectedCellIds((prev) => ({
              ...prev,
              [currentPage]: prevBestId,
            }));
          }
        } catch {}
      }
    }
  };

  const handleReset = () => {
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    }
    setHistories((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), { board: currentBoard, tapsAdded: 0 }],
    }));
    setTapCounts((prev) => ({
      ...prev,
      [currentPage]: 0,
    }));
    const blank = pageConfig.blankBoard;
    setBoards((prev) => ({
      ...prev,
      [currentPage]: blank,
    }));

    if (autoMode) {
      try {
        const blankBoardArr = activeCells.map((cell) => blank[cell.id] ?? 0);
        const blankPlan = planNextTap(blankBoardArr, activeAffected, activeGoal, 100, 0x12345678);
        if (blankPlan && activeCells[blankPlan.bestIndex]) {
          const blankBestId = activeCells[blankPlan.bestIndex].id;
          setSelectedCellIds((prev) => ({
            ...prev,
            [currentPage]: blankBestId,
          }));
        }
      } catch {}
    }
  };

  const handleSetSelectedCell = (id: string) => {
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    }
    setSelectedCellIds((prev) => ({
      ...prev,
      [currentPage]: id,
    }));
  };

  const handleToggleAutoMode = () => {
    setAutoMode((prev) => {
      const next = !prev;
      if (next && bestMove && !isMaxed) {
        handleSetSelectedCell(bestMove.id);
      }
      return next;
    });
  };

  const runAutoSimulateStep = (boardState: Record<string, number>) => {
    if (!isAutoSimulatingRef.current) return;

    const currentTotal = Object.values(boardState).reduce((sum, s) => sum + s, 0);
    if (currentTotal >= activeGoal) {
      stopAutoSimulate();
      return;
    }

    const boardArr = activeCells.map((cell) => boardState[cell.id] ?? 0);
    let planResult: PlanResult | null = null;
    try {
      planResult = planNextTap(boardArr, activeAffected, activeGoal, 100, 0x12345678);
    } catch {
      stopAutoSimulate();
      return;
    }

    if (!planResult || !activeCells[planResult.bestIndex]) {
      stopAutoSimulate();
      return;
    }

    const tapCell = activeCells[planResult.bestIndex];
    const targets = getNeighbors(activeCells, tapCell.id);
    const nextBoard: Record<string, number> = { ...boardState };
    targets.forEach((id) => {
      nextBoard[id] = rollStar();
    });

    setHistories((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), { board: boardState, tapsAdded: 1 }],
    }));
    setTapCounts((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? 0) + 1,
    }));
    setBoards((prev) => ({
      ...prev,
      [currentPage]: nextBoard,
    }));
    setSelectedCellIds((prev) => ({
      ...prev,
      [currentPage]: tapCell.id,
    }));
    setAnimatingIds(targets);

    const speed = autoSpeedRef.current;
    if (speed === 'instant') {
      runInstantSimulation();
      return;
    }

    const animDuration = Math.max(10, Math.round(90 / speed));
    const stepDelay = Math.max(12, Math.round(120 / speed));

    setTimeout(() => {
      setAnimatingIds([]);
    }, animDuration);

    const nextTotal = Object.values(nextBoard).reduce((sum, s) => sum + s, 0);
    if (nextTotal >= activeGoal) {
      stopAutoSimulate();
      return;
    }

    try {
      const nextArr = activeCells.map((cell) => nextBoard[cell.id] ?? 0);
      const nextPlan = planNextTap(nextArr, activeAffected, activeGoal, 100, 0x12345678);
      if (nextPlan && activeCells[nextPlan.bestIndex]) {
        setSelectedCellIds((prev) => ({
          ...prev,
          [currentPage]: activeCells[nextPlan.bestIndex].id,
        }));
      }
    } catch {}

    autoSimTimeoutRef.current = window.setTimeout(() => {
      if (isAutoSimulatingRef.current) {
        runAutoSimulateStep(nextBoard);
      }
    }, stepDelay);
  };

  const handleToggleAutoSimulate = () => {
    if (isAutoSimulatingRef.current) {
      stopAutoSimulate();
    } else {
      if (isMaxed) return;
      if (autoSpeedRef.current === 'instant') {
        runInstantSimulation();
      } else {
        isAutoSimulatingRef.current = true;
        setIsAutoSimulating(true);
        runAutoSimulateStep(currentBoard);
      }
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">JOLEN SIMULATOR</div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-add-page"
            onClick={handleAddNewPage}
            title="Create and add a new Awakening Page"
          >
            <span className="builder-btn-icon">➕</span>
            <span className="builder-btn-text">ADD PAGE</span>
          </button>
          <button
            type="button"
            className="btn-open-builder"
            onClick={handleOpenBuilderForCurrentPage}
            title="Open Awakening Page Builder"
          >
            <span className="builder-btn-icon">🛠️</span>
            <span className="builder-btn-text">PAGE BUILDER</span>
          </button>
          <PageDropdown
            currentPage={currentPage}
            pages={pages}
            onSelectPage={handlePageChange}
            onAddNewPage={handleAddNewPage}
            onOpenBuilder={handleOpenBuilderForCurrentPage}
            onDeleteCustomPage={handleDeleteCustomPage}
          />
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          {/* Left Side: Board Stage & Quick Star Editor */}
          <section className="board-section" aria-label={`Awakening page ${currentPage} board`}>
            <div className="panel-topline">
              <div className="topline-left-controls">
                <span>AWAKENING BOARD</span>
                <span className="topline-hint">Select a cell to set its stars · right-click for quick edit</span>
              </div>

              <div className="topline-metrics">
                <span className="metric-tag">
                  TOTAL: <strong>{totalStars}</strong> / {activeGoal} ★
                </span>
                {activeGoal !== maxPossibleStars && (
                  <span className="metric-tag max-possible" title={`Maximum possible stars obtainable if every cell reaches 6★ (${activeCells.length} cells × 6★)`}>
                    MAX POSSIBLE: <strong>{maxPossibleStars}★</strong>
                  </span>
                )}
                <span className="node-count-badge">{activeCells.length} NODES</span>
              </div>
            </div>

            <div className="board-stage-wrapper">
              {/* In-Game Left & Right Navigation Arrows flanking the Board */}
              <button
                type="button"
                className="board-nav-arrow arrow-left"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === minPage}
                aria-label="Go to previous awakening page"
                title={`Go to Page ${currentPage - 1}`}
              >
                ‹
              </button>

              <div className="board-stage">
                <Board
                  cells={activeCells}
                  board={currentBoard}
                  selectedCellId={selectedCellId}
                  affectedNeighbors={affectedNeighbors}
                  animatingIds={animatingIds}
                  bestMoveId={isMaxed ? undefined : bestMove?.id}
                  hoveredCellId={hoveredCellId}
                  onSelectCell={handleSetSelectedCell}
                  onSetCellStar={handleSetCellStar}
                  onHoverCell={setHoveredCellId}
                />
              </div>

              <button
                type="button"
                className={`board-nav-arrow arrow-right ${currentPage === maxPage && maxPage < TOTAL_PAGES_IN_GAME ? 'arrow-add' : ''}`}
                onClick={() => {
                  if (currentPage < maxPage) {
                    handlePageChange(currentPage + 1);
                  } else if (maxPage < TOTAL_PAGES_IN_GAME) {
                    handleAddNewPage();
                  }
                }}
                disabled={currentPage === maxPage && maxPage >= TOTAL_PAGES_IN_GAME}
                aria-label={currentPage === maxPage && maxPage < TOTAL_PAGES_IN_GAME ? `Add Page ${maxPage + 1}` : 'Go to next awakening page'}
                title={currentPage === maxPage && maxPage < TOTAL_PAGES_IN_GAME ? `Add Page ${maxPage + 1} with Page Builder` : `Go to Page ${currentPage + 1}`}
              >
                {currentPage === maxPage && maxPage < TOTAL_PAGES_IN_GAME ? '➕' : '›'}
              </button>

              {/* In-Game Bottom Page Indicator on Board */}
              <div className="board-page-counter" aria-label={`Page ${currentPage} of ${TOTAL_PAGES_IN_GAME}`}>
                {currentPage} / {TOTAL_PAGES_IN_GAME}
              </div>
            </div>

            {/* Board Bottom Action Bar: Quick Star Level Setter & Simulator Actions */}
            <div className="board-bottom-bar combined-bottom-bar">
              <div className="bottom-bar-node-editor">
                <div className="edit-bar-node-info">
                  <span className="edit-bar-tag">CELL {selectedDef.id}</span>
                  <span className="edit-bar-kind">{selectedDef.kind.toUpperCase()}</span>
                </div>

                <div className="edit-bar-star-picker" role="radiogroup" aria-label={`Select star level for Cell ${selectedDef.id}`}>
                  <button
                    type="button"
                    className={`star-pick-btn star-0 ${(currentBoard[selectedDef.id] ?? selectedDef.defaultStar ?? 0) === 0 ? 'is-active' : ''}`}
                    onClick={() => handleSetCellStar(selectedDef.id, 0)}
                    aria-label={`Set Cell ${selectedDef.id} to empty (0 stars)`}
                    title="Set to empty (0★)"
                  >
                    0★
                  </button>
                  {STARS.map((star) => {
                    const currentStar = currentBoard[selectedDef.id] ?? selectedDef.defaultStar ?? 0;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`star-pick-btn star-${star} ${currentStar === star ? 'is-active' : ''}`}
                        onClick={() => handleSetCellStar(selectedDef.id, star)}
                        aria-label={`Set Cell ${selectedDef.id} to ${star} stars`}
                      >
                        {star}★
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={`bottom-bar-tap-counter ${currentTapCount > 0 ? 'has-taps' : ''} ${isAutoSimulating ? 'is-running' : ''} ${autoSpeed === 'instant' ? 'is-instant-mode' : ''}`}
                title={`Total taps simulated on Page ${currentPage}${currentTapCount > 0 ? ' · Click ↺ to reset tap count' : ''}`}
                aria-label={`Simulated taps: ${currentTapCount}`}
              >
                <span className="tap-counter-icon" aria-hidden="true">⚡</span>
                <span className="tap-counter-label">TAPS:</span>
                <strong className="tap-counter-val">{currentTapCount}</strong>
                {currentTapCount > 0 && (
                  <button
                    type="button"
                    className="tap-counter-reset-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetTapCount();
                    }}
                    title="Reset tap count to 0"
                    aria-label="Reset tap count"
                  >
                    ↺
                  </button>
                )}
              </div>

              <div className="bottom-bar-actions">
                <button
                  type="button"
                  className={`btn-secondary btn-auto-toggle ${autoMode ? 'is-active' : ''}`}
                  onClick={handleToggleAutoMode}
                  aria-pressed={autoMode}
                  disabled={isAutoSimulating}
                  title={
                    autoMode
                      ? 'Auto Mode ON: Automatically selects recommended tip cell after each tap'
                      : 'Auto Mode OFF: Click to enable auto-selecting recommended tip cell'
                  }
                >
                  <span className="auto-toggle-dot" aria-hidden="true" />
                  <span className="auto-toggle-text">AUTO</span>
                  <span className="auto-toggle-badge">{autoMode ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleUndo}
                  disabled={currentHistory.length === 0 || isAutoSimulating}
                  title="Undo last change"
                >
                  UNDO ({currentHistory.length})
                </button>

                <button
                  type="button"
                  className={`btn-awaken ${!isMaxed && selectedCellId === bestMove?.id ? 'is-recommended-action' : ''}`}
                  onClick={handleAwaken}
                  aria-label={`Simulate awakening Cell ${selectedDef.id}`}
                  title={
                    isMaxed
                      ? `Goal reached (${activeGoal}★)`
                      : `Simulate a tap on Cell ${selectedDef.id} (${affectedNeighbors.length} Anima · ${(affectedNeighbors.length * GOLD_PER_CELL).toLocaleString()} Gold)`
                  }
                  disabled={isMaxed || isAutoSimulating}
                >
                  SIMULATE TAP
                </button>

                <button
                  type="button"
                  className={`btn-auto-max ${isAutoSimulating ? 'is-running' : ''} ${autoSpeed === 'instant' ? 'is-instant-mode' : ''}`}
                  onClick={handleToggleAutoSimulate}
                  disabled={isMaxed && !isAutoSimulating}
                  aria-label={
                    isAutoSimulating
                      ? 'Stop automatic simulation'
                      : autoSpeed === 'instant'
                      ? `Instantly solve to Level ${activeGoal} max awakening in 1 frame`
                      : `Automatically simulate taps until Level ${activeGoal} max awakening (${autoSpeed}x speed)`
                  }
                  title={
                    isMaxed
                      ? `Goal reached (${activeGoal}★)`
                      : isAutoSimulating
                      ? 'Click to stop auto simulation'
                      : autoSpeed === 'instant'
                      ? `Instantly simulate optimal taps in 1 frame until reaching max awakening goal (${activeGoal}★)`
                      : `Continuously simulate optimal taps at ${autoSpeed}x speed until reaching max awakening goal (${activeGoal}★)`
                  }
                >
                  {isAutoSimulating ? (
                    <>
                      <span className="stop-icon" aria-hidden="true">■</span> STOP AUTO
                    </>
                  ) : autoSpeed === 'instant' ? (
                    <>
                      <span className="lightning-icon" aria-hidden="true">⚡</span> INSTANT MAX
                    </>
                  ) : (
                    <>
                      <span className="lightning-icon" aria-hidden="true">⚡</span> AUTO TO MAX
                    </>
                  )}
                </button>
              </div>

              <div
                className={`auto-speed-selector ${isAutoSimulating ? 'is-running' : ''} ${autoSpeed === 'instant' ? 'is-instant-mode' : ''}`}
                role="radiogroup"
                aria-label="Auto simulation speed multiplier or instant mode"
              >
                {([1, 3, 5, 10, 'instant'] as const).map((spd) => {
                  const isInstant = spd === 'instant';
                  const label = isInstant ? '⚡ INSTANT' : `${spd}x`;
                  const title = isInstant
                    ? 'Instant mode: Solve to max in 1 frame'
                    : `Set auto simulation speed to ${spd}x (${Math.round(120 / spd)}ms/tap)`;

                  return (
                    <button
                      key={String(spd)}
                      type="button"
                      className={`speed-btn ${isInstant ? 'is-instant' : ''} ${autoSpeed === spd ? 'is-active' : ''}`}
                      onClick={() => handleSetAutoSpeed(spd)}
                      title={title}
                      aria-pressed={autoSpeed === spd}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-secondary reset-btn"
                onClick={handleReset}
                disabled={isAutoSimulating}
                title="Clear all nodes on this board to 0 stars"
              >
                RESET BOARD
              </button>
            </div>

          </section>

          {/* Right Side: Overall Awakening Thresholds & Advisor Panel */}
          <aside className="controls-panel" aria-label="Overall Awakening Thresholds and Advisor">
            {/* Authentic Tab Header: Cell Effect | Awakening Effects */}
            <div className="effects-tab-header">
              <button type="button" className="effects-tab-btn">Cell Effect</button>
              <button type="button" className="effects-tab-btn is-active">
                {pageConfig.romanNumeral} Awakening Effects
              </button>
            </div>

            <div className="controls-body">
              {/* Overall Awakening Level Header Card */}
              <div className="overall-level-hero">
                <div className="level-badge-pill">
                  <span className="level-diamond">◆</span>
                  <span className="level-number">{totalStars}</span>
                </div>
                <div className="level-text-group">
                  <div className="level-main-title">Overall Awakening Level</div>
                  <div className="next-milestone-hint">
                    CURRENT: <strong>{currentThreshold ? `LEVEL ${currentThreshold.level}` : 'UNRANKED (0★)'}</strong>
                    {nextThreshold
                      ? ` · NEXT: ${nextThreshold.level} (${nextThreshold.level - totalStars}★ TO GO)`
                      : ' · ALL UNLOCKED'}
                  </div>
                </div>
              </div>

              {/* Milestone timeline */}
              <div className="thresholds-timeline-wrapper">
                <div className="timeline-header-label">
                  <div className="target-indicator-text">
                    PAGE GOAL: <strong>LEVEL {activeGoal}★</strong>{' '}
                    <span className="target-needed">
                      {isMaxed
                        ? '(MAX LEVEL REACHED)'
                        : `(${activeGoal - totalStars}★ NEEDED${pageConfig.isMaxFromCellCount ? ' · ALL 6★' : ''})`}
                    </span>
                  </div>
                </div>

                {pageConfig.isMaxFromCellCount && (
                  <div className="cell-max-info-banner">
                    <span className="banner-icon">ℹ️</span>
                    <div className="banner-text">
                      <strong>In-Game Milestones Locked</strong>
                      <p>
                        Specific milestone thresholds have not been unlocked in-game yet.
                        The target is set to the <strong>maximum possible stars ({maxPossibleStars}★)</strong> obtainable from all {activeCells.length} cells.
                      </p>
                    </div>
                  </div>
                )}

                <div className="thresholds-list" ref={thresholdsListRef}>
                  {activeThresholds.map((t) => {
                    const isReached = totalStars >= t.level;
                    const isCurrent = currentThreshold ? currentThreshold.level === t.level : false;
                    return (
                      <div
                        key={t.level}
                        id={`threshold-${t.level}`}
                        className={`threshold-item ${isReached ? 'is-reached' : 'is-locked'} ${isCurrent ? 'is-current' : ''}`}
                      >
                        <div className="threshold-marker">
                          <span className="marker-diamond">◆</span>
                          <span className="marker-pill">{t.level}</span>
                        </div>
                        <div className="threshold-effects">
                          {t.effects.map((eff, i) => (
                            <div key={i} className="effect-entry">
                              <span className="effect-name">{eff.name}</span>
                              <span className="effect-val">{eff.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tip / Recommendation Card or Maxed Notice */}
              {isMaxed ? (
                <div className="advisor-card is-maxed">
                  <div className="advisor-header">
                    <span className="advisor-badge maxed">
                      <span className="sparkle">✦</span> MAX AWAKENING ACHIEVED
                    </span>
                    <span className="advisor-target-tag maxed">PAGE {String(currentPage).padStart(2, '0')} · MAXED</span>
                  </div>
                  <div className="maxed-message-body">
                    <div className="maxed-status-badge">LEVEL {totalStars} / {activeGoal}★</div>
                    <div className="maxed-desc">
                      {currentTapCount > 0
                        ? `Maximum awakening reached in ${currentTapCount} tap${currentTapCount === 1 ? '' : 's'}!`
                        : 'You have reached the maximum awakening goal on this page.'}
                    </div>
                  </div>
                </div>
              ) : bestMove && tipStats ? (
                <div className="comparison-cards-wrapper">
                  {/* Card 1: Tip Cell Stats */}
                  <div className="advisor-card tip-card">
                    <div className="advisor-header">
                      <span className="advisor-badge">
                        <span className="sparkle">✦</span> TIP: CELL {bestMove.id}
                      </span>
                      {selectedCellId !== bestMove.id && (
                        <button
                          type="button"
                          className="btn-select-tip"
                          onClick={() => handleSetSelectedCell(bestMove.id)}
                          title={`Select Cell ${bestMove.id} on board`}
                        >
                          SELECT
                        </button>
                      )}
                    </div>

                    <div className="stat-chances-grid">
                      <div className="chance-pill gain">
                        <span className="chance-label">GAIN CHANCE</span>
                        <span className="chance-val">+{tipStats.gainPercent}%</span>
                      </div>
                      <div className="chance-pill loss">
                        <span className="chance-label">LOSS CHANCE</span>
                        <span className="chance-val">-{tipStats.lossPercent}%</span>
                      </div>
                      <div className="chance-pill delta">
                        <span className="chance-label">EXP. CHANGE</span>
                        <span className={`chance-val ${tipStats.expectedDelta >= 0 ? 'pos' : 'neg'}`}>
                          {tipStats.expectedDelta >= 0 ? `+${tipStats.expectedDelta.toFixed(1)}` : tipStats.expectedDelta.toFixed(1)}★
                        </span>
                      </div>
                      <div className="chance-pill risk">
                        <span className="chance-label">6★ AT RISK</span>
                        <span className={`chance-val ${tipStats.count6 > 0 ? 'warn' : 'safe'}`}>
                          {tipStats.count6 > 0 ? `${tipStats.count6} node${tipStats.count6 > 1 ? 's' : ''}` : '0 (Safe)'}
                        </span>
                      </div>
                    </div>

                    <div className="affected-nodes-row">
                      <span className="nodes-label">AFFECTED:</span>
                      <span className="nodes-list">
                        {tipStats.affectedSummary.map((n) => `${n.id} (${n.star}★)`).join(', ')}
                      </span>
                    </div>

                    {tipExplanation && (
                      <div className="tip-explanation-body">
                        {tipExplanation}
                      </div>
                    )}
                  </div>

                  {/* Card 2: Hovered / Manual Comparison Cell */}
                  <div className={`advisor-card compare-card ${compareStats ? 'has-data' : 'is-empty'}`}>
                    {compareStats && compareCell ? (
                      <>
                        <div className="advisor-header">
                          <span className="advisor-badge compare">
                            <span className="compare-icon">🔍</span> {hoveredCellId ? 'HOVERED' : 'SELECTED'}: CELL {compareCell.id}
                          </span>
                          {selectedCellId !== compareCell.id && (
                            <button
                              type="button"
                              className="btn-select-compare"
                              onClick={() => handleSetSelectedCell(compareCell.id)}
                              title={`Select Cell ${compareCell.id} on board`}
                            >
                              SELECT
                            </button>
                          )}
                        </div>

                        <div className="stat-chances-grid">
                          <div className="chance-pill gain">
                            <span className="chance-label">GAIN CHANCE</span>
                            <span className="chance-val">+{compareStats.gainPercent}%</span>
                          </div>
                          <div className="chance-pill loss">
                            <span className="chance-label">LOSS CHANCE</span>
                            <span className="chance-val">-{compareStats.lossPercent}%</span>
                          </div>
                          <div className="chance-pill delta">
                            <span className="chance-label">EXP. CHANGE</span>
                            <span className={`chance-val ${compareStats.expectedDelta >= 0 ? 'pos' : 'neg'}`}>
                              {compareStats.expectedDelta >= 0 ? `+${compareStats.expectedDelta.toFixed(1)}` : compareStats.expectedDelta.toFixed(1)}★
                            </span>
                          </div>
                          <div className="chance-pill risk">
                            <span className="chance-label">6★ AT RISK</span>
                            <span className={`chance-val ${compareStats.count6 > 0 ? 'warn' : 'safe'}`}>
                              {compareStats.count6 > 0 ? `${compareStats.count6} node${compareStats.count6 > 1 ? 's' : ''}` : '0 (Safe)'}
                            </span>
                          </div>
                        </div>

                        <div className="affected-nodes-row">
                          <span className="nodes-label">AFFECTED:</span>
                          <span className="nodes-list">
                            {compareStats.affectedSummary.map((n) => `${n.id} (${n.star}★)`).join(', ')}
                          </span>
                        </div>

                        <div className="compare-comparison-body">
                          <strong>vs. Tip Cell {bestMove.id}:</strong>{' '}
                          {getComparisonInsight(compareStats, tipStats, bestMove.id)}
                        </div>
                      </>
                    ) : (
                      <div className="compare-empty-prompt">
                        <span className="compare-empty-icon">🔍</span>
                        <div className="compare-empty-title">MANUAL COMPARISON</div>
                        <div className="compare-empty-text">
                          Hover over any node on the board to compare its gain/loss chances side-by-side with Tip Cell {bestMove.id}.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Odds Reference Note */}
              <div className="odds-reference-note">
                <div className="odds-header">
                  <span className="odds-title">OFFICIAL ODDS</span>
                  <a
                    href="https://architectgb.drimage.com/en/info/probability?subKey=AWAKENING&type=15"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="odds-source-link"
                    title="View official probability table on Architect website"
                  >
                    ARCHITECT SOURCE ↗
                  </a>
                </div>
                <div className="odds-grid">
                  {STARS.map((star) => (
                    <div key={star} className="odds-item">
                      <span
                        className="odds-star"
                        style={{ color: STAR_COLORS[star] }}
                      >
                        {star}★
                      </span>
                      <span className="odds-rate">{(STAR_PROBABILITIES[star] * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

      </main>

      {isBuilderOpen && (
        <PageBuilder
          initialPage={builderInitialPage}
          onClose={() => setIsBuilderOpen(false)}
          onSavePage={handleSaveCustomPage}
        />
      )}
    </div>
  );
}
