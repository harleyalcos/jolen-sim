import React, { useState, useMemo } from 'react';
import { type TrainingDataPoint } from '../weights.ts';

interface TrainingChartProps {
  data: TrainingDataPoint[];
  baselineTaps?: number;
}

export const TrainingChart: React.FC<TrainingChartProps> = ({
  data,
  baselineTaps = 4800,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<TrainingDataPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // SVG viewport dimensions
  const width = 800;
  const height = 360;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const { minTaps, maxTaps, minGen, maxGen, pointsWithCoords } = useMemo(() => {
    if (data.length === 0) {
      return { minTaps: 1000, maxTaps: 5500, minGen: 0, maxGen: 50, pointsWithCoords: [] };
    }

    const minGenVal = data[0].generation;
    const maxGenVal = Math.max(data[data.length - 1].generation, minGenVal + 5);

    let lowTaps = Math.min(...data.map((d) => Math.min(d.bestAvgTaps, d.allTimeBestTaps)));
    let highTaps = Math.max(
      baselineTaps,
      ...data.map((d) => Math.max(d.bestAvgTaps, d.worstTaps || d.bestAvgTaps))
    );

    // Add some padding
    lowTaps = Math.max(0, Math.floor((lowTaps * 0.85) / 100) * 100);
    highTaps = Math.ceil((highTaps * 1.08) / 500) * 500;

    const scaleX = (gen: number) => {
      const span = maxGenVal - minGenVal || 1;
      return padLeft + ((gen - minGenVal) / span) * chartWidth;
    };

    const scaleY = (taps: number) => {
      const span = highTaps - lowTaps || 1;
      return padTop + chartHeight - ((taps - lowTaps) / span) * chartHeight;
    };

    const mapped = data.map((d) => ({
      data: d,
      x: scaleX(d.generation),
      yAvg: scaleY(d.bestAvgTaps),
      yBest: scaleY(d.allTimeBestTaps),
      yWorst: scaleY(d.worstTaps || d.bestAvgTaps),
    }));

    return {
      minTaps: lowTaps,
      maxTaps: highTaps,
      minGen: minGenVal,
      maxGen: maxGenVal,
      pointsWithCoords: mapped,
    };
  }, [data, baselineTaps, chartWidth, chartHeight]);

  // Construct SVG paths
  const avgPath = useMemo(() => {
    if (pointsWithCoords.length === 0) return '';
    return pointsWithCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yAvg.toFixed(1)}`)
      .join(' ');
  }, [pointsWithCoords]);

  const bestPath = useMemo(() => {
    if (pointsWithCoords.length === 0) return '';
    return pointsWithCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yBest.toFixed(1)}`)
      .join(' ');
  }, [pointsWithCoords]);

  // Area under curve for subtle gradient fill
  const areaPath = useMemo(() => {
    if (pointsWithCoords.length === 0) return '';
    const bottomY = padTop + chartHeight;
    const firstX = pointsWithCoords[0].x;
    const lastX = pointsWithCoords[pointsWithCoords.length - 1].x;
    const lineParts = pointsWithCoords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yAvg.toFixed(1)}`)
      .join(' ');
    return `${lineParts} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [pointsWithCoords, chartHeight]);

  // Y-axis grid lines (5 increments)
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const val = Math.round(minTaps + ((maxTaps - minTaps) * i) / count);
      const y = padTop + chartHeight - (i / count) * chartHeight;
      ticks.push({ val, y });
    }
    return ticks;
  }, [minTaps, maxTaps, chartHeight]);

  // X-axis grid labels
  const xTicks = useMemo(() => {
    const ticks = [];
    const count = Math.min(6, Math.max(2, data.length));
    for (let i = 0; i < count; i++) {
      const gen = Math.round(minGen + ((maxGen - minGen) * i) / (count - 1));
      const span = maxGen - minGen || 1;
      const x = padLeft + ((gen - minGen) / span) * chartWidth;
      ticks.push({ gen, x });
    }
    return ticks;
  }, [minGen, maxGen, chartWidth, data.length]);

  const baselineY = useMemo(() => {
    const span = maxTaps - minTaps || 1;
    if (baselineTaps < minTaps || baselineTaps > maxTaps) return null;
    return padTop + chartHeight - ((baselineTaps - minTaps) / span) * chartHeight;
  }, [baselineTaps, minTaps, maxTaps, chartHeight]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pointsWithCoords.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const mouseY = ((e.clientY - rect.top) / rect.height) * height;

    // Find closest point by X coordinate
    let closest = pointsWithCoords[0];
    let minDist = Math.abs(closest.x - mouseX);

    for (let i = 1; i < pointsWithCoords.length; i++) {
      const dist = Math.abs(pointsWithCoords[i].x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = pointsWithCoords[i];
      }
    }

    if (minDist < 60) {
      setHoveredPoint(closest.data);
      setHoverPos({ x: closest.x, y: closest.yAvg });
    } else {
      setHoveredPoint(null);
      setHoverPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverPos(null);
  };

  return (
    <div className="training-chart-container">
      <div className="training-chart-header">
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color line-avg"></span>
            Gen Average Taps
          </span>
          <span className="legend-item">
            <span className="legend-color line-best"></span>
            All-Time Record Frontier
          </span>
          {baselineY !== null && (
            <span className="legend-item">
              <span className="legend-color line-baseline"></span>
              Unoptimized Baseline (~{baselineTaps.toLocaleString()} taps)
            </span>
          )}
        </div>
        <div className="chart-sub">
          {data.length > 0 ? (
            <span>Showing Generations {minGen} – {data[data.length - 1].generation}</span>
          ) : (
            <span>Ready to start simulation</span>
          )}
        </div>
      </div>

      <div className="chart-svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="training-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="bestGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={`y-${i}`}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={width - padRight}
                y2={tick.y}
                stroke="#334155"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={tick.y + 4}
                fill="#94a3b8"
                fontSize="11"
                textAnchor="end"
                fontFamily="monospace"
              >
                {tick.val.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Baseline reference line */}
          {baselineY !== null && (
            <g>
              <line
                x1={padLeft}
                y1={baselineY}
                x2={width - padRight}
                y2={baselineY}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeWidth="1.5"
                opacity="0.75"
              />
              <text
                x={width - padRight - 8}
                y={baselineY - 6}
                fill="#ef4444"
                fontSize="10"
                textAnchor="end"
                fontFamily="monospace"
              >
                BASELINE
              </text>
            </g>
          )}

          {/* X Axis ticks */}
          {xTicks.map((tick, i) => (
            <g key={`x-${i}`}>
              <line
                x1={tick.x}
                y1={padTop + chartHeight}
                x2={tick.x}
                y2={padTop + chartHeight + 6}
                stroke="#475569"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={padTop + chartHeight + 20}
                fill="#94a3b8"
                fontSize="11"
                textAnchor="middle"
                fontFamily="monospace"
              >
                Gen {tick.gen}
              </text>
            </g>
          ))}

          {/* Area under curve */}
          {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

          {/* Best Record Frontier (Cyan Line) */}
          {bestPath && (
            <path
              d={bestPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              filter="url(#glow)"
            />
          )}

          {/* Generation Average Curve (Gold Line) */}
          {avgPath && (
            <path
              d={avgPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
            />
          )}

          {/* Active Data Points */}
          {pointsWithCoords.map((pt, i) => {
            const isRecent = i >= pointsWithCoords.length - 8;
            return (
              <circle
                key={`pt-${i}`}
                cx={pt.x}
                cy={pt.yAvg}
                r={isRecent ? 3.5 : 2}
                fill="#fbbf24"
                stroke="#0f172a"
                strokeWidth="1.5"
                className="chart-dot"
              />
            );
          })}

          {/* Empty state overlay */}
          {data.length === 0 && (
            <g>
              <rect
                x={padLeft}
                y={padTop}
                width={chartWidth}
                height={chartHeight}
                fill="rgba(15, 23, 42, 0.6)"
              />
              <text
                x={padLeft + chartWidth / 2}
                y={padTop + chartHeight / 2 - 10}
                fill="#38bdf8"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
              >
                AI Ready To Train
              </text>
              <text
                x={padLeft + chartWidth / 2}
                y={padTop + chartHeight / 2 + 18}
                fill="#94a3b8"
                fontSize="12"
                textAnchor="middle"
              >
                Click &ldquo;Start Training&rdquo; to begin simulating Page 3 games
              </text>
            </g>
          )}

          {/* Hover Crosshair & Pointer */}
          {hoverPos && hoveredPoint && (
            <g>
              <line
                x1={hoverPos.x}
                y1={padTop}
                x2={hoverPos.x}
                y2={padTop + chartHeight}
                stroke="#38bdf8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverPos.x}
                cy={hoverPos.y}
                r="6"
                fill="#06b6d4"
                stroke="#ffffff"
                strokeWidth="2"
                filter="url(#glow)"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip HTML Overlay */}
        {hoverPos && hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoverPos.x / width) * 100}%`,
              top: `${(hoverPos.y / height) * 100}%`,
            }}
          >
            <div className="tooltip-title">Generation {hoveredPoint.generation}</div>
            <div className="tooltip-row">
              <span>Avg Taps:</span>
              <strong className="text-gold">{hoveredPoint.bestAvgTaps.toLocaleString()}</strong>
            </div>
            <div className="tooltip-row">
              <span>All-Time Best:</span>
              <strong className="text-cyan">{hoveredPoint.allTimeBestTaps.toLocaleString()}</strong>
            </div>
            {hoveredPoint.worstTaps > 0 && (
              <div className="tooltip-row">
                <span>Worst Run:</span>
                <span className="text-muted">{hoveredPoint.worstTaps.toLocaleString()}</span>
              </div>
            )}
            <div className="tooltip-row">
              <span>Win Rate:</span>
              <strong className="text-green">{hoveredPoint.winRate}%</strong>
            </div>
            <div className="tooltip-row">
              <span>Speed:</span>
              <span className="text-cyan">{hoveredPoint.tapsPerSecond.toLocaleString()} taps/s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
