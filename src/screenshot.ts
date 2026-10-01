import { CELLS, makeEmptyBoard, type BoardState, type CellId, type Star } from './engine';

export interface Point { x: number; y: number }
export interface ScanCell { id: CellId; point: Point; star: Star | null; confidence: number }
export interface ScanResult { cells: ScanCell[]; board: BoardState; anchors: { a: Point; m: Point }; auto: boolean }

const A = CELLS[0];
const M = CELLS[CELLS.length - 1];

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function classifyColor(h: number, s: number): Star {
  if (s < 0.11) return 1;
  if (h < 22 || h >= 345) return 4;
  if (h < 72) return 6;
  if (h < 198) return 2;
  if (h < 242) return 3;
  return 5;
}

function pixel(data: ImageData, x: number, y: number) {
  const xx = Math.max(0, Math.min(data.width - 1, Math.round(x)));
  const yy = Math.max(0, Math.min(data.height - 1, Math.round(y)));
  const n = (yy * data.width + xx) * 4;
  return hsv(data.data[n], data.data[n + 1], data.data[n + 2]);
}

function readCell(data: ImageData, point: Point, radius: number): { star: Star | null; confidence: number } {
  const votes = [0, 0, 0, 0, 0, 0, 0];
  let usable = 0;
  // The icon and star dots sit in the center. Read the colored cell face around them.
  for (const fraction of [0.30, 0.42, 0.54]) {
    for (let i = 0; i < 32; i += 1) {
      const angle = (i + (fraction === 0.42 ? 0.5 : 0)) * Math.PI / 16;
      const sample = pixel(data, point.x + Math.cos(angle) * radius * fraction, point.y + Math.sin(angle) * radius * fraction);
      if (sample.v < 0.12 || sample.v > 0.91) continue;
      const star = classifyColor(sample.h, sample.s);
      const weight = star === 1 ? 0.4 : Math.min(2, 0.7 + sample.s * 3);
      votes[star] += weight;
      usable += weight;
    }
  }
  const ranked = [1, 2, 3, 4, 5, 6].sort((a, b) => votes[b] - votes[a]);
  const top = votes[ranked[0]];
  const second = votes[ranked[1]];
  const confidence = usable ? (top - second) / usable : 0;
  return { star: usable > 4 ? ranked[0] as Star : null, confidence };
}

export function scanAtAnchors(data: ImageData, a: Point, m: Point, auto = false): ScanResult {
  const scaleX = (m.x - a.x) / (M.x - A.x);
  const scaleY = (m.y - a.y) / (M.y - A.y);
  const radius = 57 * (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
  const board = makeEmptyBoard();
  const cells = CELLS.map((cell) => {
    const point = { x: a.x + (cell.x - A.x) * scaleX, y: a.y + (cell.y - A.y) * scaleY };
    const reading = readCell(data, point, radius);
    board[cell.id] = reading.star;
    return { id: cell.id, point, ...reading };
  });
  return { cells, board, anchors: { a, m }, auto };
}

function colorEnergy(data: ImageData, x: number, y: number): number {
  const n = (y * data.width + x) * 4;
  const { s, v } = hsv(data.data[n], data.data[n + 1], data.data[n + 2]);
  return Math.max(0, s - 0.09) * Math.max(0, v - 0.14);
}

export function autoScan(data: ImageData): ScanResult {
  const stride = data.width + 1;
  const integral = new Float32Array(stride * (data.height + 1));
  for (let y = 1; y <= data.height; y += 1) {
    let row = 0;
    for (let x = 1; x <= data.width; x += 1) {
      row += colorEnergy(data, x - 1, y - 1);
      integral[y * stride + x] = integral[(y - 1) * stride + x] + row;
    }
  }
  const box = (x: number, y: number, r: number) => {
    const x0 = Math.max(0, Math.round(x - r)); const x1 = Math.min(data.width, Math.round(x + r));
    const y0 = Math.max(0, Math.round(y - r)); const y1 = Math.min(data.height, Math.round(y + r));
    return (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / Math.max(1, (x1 - x0) * (y1 - y0));
  };
  let best = { score: -Infinity, a: { x: 0, y: 0 }, scale: 0.67 };
  const maxScale = Math.min(1.8, data.width / 430, data.height / 370);
  for (let scale = 0.38; scale <= maxScale; scale += 0.06) {
    const margin = Math.max(4, 18 * scale);
    const maxX = data.width - 416 * scale - margin;
    const maxY = data.height - 360 * scale - margin;
    const step = Math.max(5, Math.round(12 * scale));
    for (let y = margin; y < maxY; y += step) {
      for (let x = margin; x < maxX; x += step) {
        let score = 0;
        for (const cell of CELLS) score += box(x + (cell.x - A.x) * scale, y + (cell.y - A.y) * scale, 17 * scale);
        if (score > best.score) best = { score, a: { x, y }, scale };
      }
    }
  }
  const a = best.a;
  const m = { x: a.x + 416 * best.scale, y: a.y + 360 * best.scale };
  return scanAtAnchors(data, a, m, true);
}

export function reviseScanCell(scan: ScanResult, id: CellId, star: Star): ScanResult {
  return {
    ...scan,
    board: { ...scan.board, [id]: star },
    cells: scan.cells.map((cell) => cell.id === id ? { ...cell, star, confidence: 1 } : cell),
  };
}
