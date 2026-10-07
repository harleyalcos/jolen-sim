export type Kind = 'sword' | 'shield' | 'drop';

export interface CellDef {
  id: string;
  x: number;
  y: number;
  kind: Kind;
  defaultStar?: number;
  isCenter?: boolean;
}

export interface Threshold {
  level: number;
  effects: { name: string; value: string }[];
}

export interface PageDefinition {
  page: number;
  label?: string; // e.g. 'PAGE 01' (defaults to 'PAGE ' + 2-digit number)
  romanNumeral?: string; // e.g. 'I' (defaults to Roman numeral conversion)
  goalStars: number;
  defaultSelectedCellId?: string; // Cell to select initially (defaults to first center node or first node)
  storageKey?: string; // localStorage key for board state (defaults to `awakening_p${page}_board`)
  cells: CellDef[];
  thresholds: Threshold[];
}

export interface ProcessedPageConfig {
  page: number;
  label: string;
  romanNumeral: string;
  goalStars: number;
  maxPossibleStars: number;
  isMaxFromCellCount: boolean;
  defaultSelectedCellId: string;
  storageKey: string;
  cells: CellDef[];
  thresholds: Threshold[];
  initialBoard: Record<string, number>;
  blankBoard: Record<string, number>;
  affected: number[][];
  nodeCount: number;
}

export function toRoman(num: number): string {
  const romanMap: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = num;
  let result = '';
  for (const [val, roman] of romanMap) {
    while (n >= val) {
      result += roman;
      n -= val;
    }
  }
  return result || String(num);
}

export function getNeighbors(cells: CellDef[], cellId: string): string[] {
  const target = cells.find((c) => c.id === cellId);
  if (!target) return [cellId];
  return cells
    .filter((c) => Math.hypot(c.x - target.x, c.y - target.y) < 135)
    .map((c) => c.id);
}

export function calculateAffected(cells: CellDef[]): number[][] {
  return cells.map((cell) =>
    getNeighbors(cells, cell.id).map((id) =>
      cells.findIndex((candidate) => candidate.id === id),
    ),
  );
}

export function processPageDefinition(def: PageDefinition): ProcessedPageConfig {
  const maxPossible = def.cells.length * 6;
  const goalStars = def.goalStars > 0 ? def.goalStars : maxPossible;
  const isMaxFromCellCount =
    !def.thresholds ||
    def.thresholds.length === 0 ||
    (def.thresholds.length === 1 && def.thresholds[0].level === maxPossible) ||
    goalStars === maxPossible;

  const defaultSelected =
    def.defaultSelectedCellId ??
    def.cells.find((c) => c.isCenter)?.id ??
    def.cells[0]?.id ??
    'A';

  const initialBoard: Record<string, number> = Object.fromEntries(
    def.cells.map((c) => [c.id, c.defaultStar ?? 0]),
  );

  const blankBoard: Record<string, number> = Object.fromEntries(
    def.cells.map((c) => [c.id, 0]),
  );

  const affected = calculateAffected(def.cells);

  const thresholds =
    def.thresholds && def.thresholds.length > 0
      ? def.thresholds
      : [
          {
            level: goalStars,
            effects: [
              {
                name: 'Maximum Obtainable',
                value: `${goalStars}★ (All 6★)`,
              },
            ],
          },
        ];

  return {
    page: def.page,
    label: def.label ?? `PAGE ${String(def.page).padStart(2, '0')}`,
    romanNumeral: def.romanNumeral ?? toRoman(def.page),
    goalStars,
    maxPossibleStars: maxPossible,
    isMaxFromCellCount,
    defaultSelectedCellId: defaultSelected,
    storageKey: def.storageKey ?? `awakening_p${def.page}_board`,
    cells: def.cells,
    thresholds,
    initialBoard,
    blankBoard,
    affected,
    nodeCount: def.cells.length,
  };
}

/* =========================================================================
   CANONICAL HEX GRID GEOMETRY REFERENCE (Architect: Land of Exiles)
   Row spacing Δy = 110px. Staggered column spacing Δx ≈ 125.5px (offset ~63px).

   Row 0 (y: 250): Even -> x: 459, 584, 710, 835, 961, 1086, 1212, 1337
   Row 1 (y: 360): Odd  -> x: 521, 647, 772, 898, 1023, 1149, 1274, 1400
   Row 2 (y: 470): Even -> x: 459, 584, 710, 835, 961, 1086, 1212, 1337
   Row 3 (y: 580): Odd  -> x: 521, 647, 772, 898, 1023, 1149, 1274, 1400
   Row 4 (y: 690): Even -> x: 459, 584, 710, 835, 961, 1086, 1212, 1337
   Row 5 (y: 800): Odd  -> x: 521, 647, 772, 898, 1023, 1149, 1274, 1400
   Row 6 (y: 910): Even -> x: 459, 584, 710, 835, 961, 1086, 1212, 1337
   Row 7 (y: 1020): Odd -> x: 521, 647, 772, 898, 1023, 1149, 1274, 1400
   ========================================================================= */

// --- PAGE 1 ---
export const PAGE_ONE_DEF: PageDefinition = {
  page: 1,
  goalStars: 80,
  defaultSelectedCellId: 'L',
  storageKey: 'awakening_p1_board',
  cells: [
    { id: 'A', x: 771, y: 360, kind: 'sword' },
    { id: 'B', x: 1148, y: 360, kind: 'shield' },
    { id: 'C', x: 708, y: 470, kind: 'drop' },
    { id: 'D', x: 1210, y: 470, kind: 'sword' },
    { id: 'E', x: 646, y: 580, kind: 'drop' },
    { id: 'F', x: 1273, y: 580, kind: 'drop' },
    { id: 'G', x: 708, y: 690, kind: 'drop' },
    { id: 'H', x: 1210, y: 690, kind: 'drop' },
    { id: 'I', x: 646, y: 800, kind: 'drop' },
    { id: 'J', x: 896, y: 800, kind: 'shield' },
    { id: 'K', x: 1022, y: 800, kind: 'drop' },
    { id: 'L', x: 1273, y: 800, kind: 'drop' },
    { id: 'M', x: 708, y: 910, kind: 'drop' },
    { id: 'N', x: 834, y: 910, kind: 'sword' },
    { id: 'O', x: 1084, y: 910, kind: 'shield' },
    { id: 'P', x: 1210, y: 910, kind: 'drop' },
  ],
  thresholds: [
    { level: 14, effects: [{ name: 'Attack Power against Monsters', value: '5' }] },
    { level: 23, effects: [{ name: 'Normal Attack Accuracy', value: '5' }] },
    { level: 28, effects: [{ name: 'Skill Critical Hit', value: '3' }] },
    { level: 31, effects: [{ name: 'HP Regen', value: '1' }] },
    { level: 34, effects: [{ name: 'Attack Power against Monsters', value: '5' }] },
    { level: 37, effects: [{ name: 'Normal Attack Critical Hit', value: '3' }] },
    { level: 39, effects: [{ name: 'HP Potion Healing Increase Rate', value: '1%' }] },
    { level: 42, effects: [{ name: 'Accuracy against Monsters', value: '5' }] },
    { level: 44, effects: [{ name: 'Skill Attack', value: '5' }] },
    { level: 46, effects: [{ name: 'Accuracy against Monsters', value: '5' }] },
    { level: 48, effects: [{ name: 'Basic Attack', value: '5' }] },
    { level: 50, effects: [{ name: 'Skill Accuracy', value: '5' }] },
    { level: 51, effects: [{ name: 'Monster Defense', value: '5' }] },
    { level: 53, effects: [{ name: 'Normal Attack Critical Hit', value: '5' }] },
    { level: 55, effects: [{ name: 'Accuracy against Monsters', value: '10' }] },
    { level: 56, effects: [{ name: 'Skill Critical Hit', value: '5' }] },
    { level: 58, effects: [{ name: 'Basic Attack', value: '10' }] },
    { level: 59, effects: [{ name: 'Skill Defense', value: '10' }] },
    { level: 61, effects: [{ name: 'Basic Attack Defense', value: '10' }] },
    { level: 62, effects: [{ name: 'Skill Attack', value: '10' }] },
    {
      level: 64,
      effects: [
        { name: 'Increase HP Potion Healing', value: '3%' },
        { name: 'Basic Attack Critical Hit Resistance', value: '5' },
      ],
    },
    {
      level: 66,
      effects: [
        { name: 'Skill Accuracy', value: '15' },
        { name: 'Skill Evasion', value: '3' },
      ],
    },
    { level: 68, effects: [{ name: 'Skill Critical Hit', value: '10' }] },
    {
      level: 69,
      effects: [
        { name: 'Max HP', value: '90' },
        { name: 'Skill Critical Hit', value: '2' },
      ],
    },
    {
      level: 70,
      effects: [
        { name: 'Attack Power against Monsters', value: '20' },
        { name: 'Skill Defense', value: '5' },
      ],
    },
    {
      level: 71,
      effects: [
        { name: 'Normal Attack Accuracy', value: '20' },
        { name: 'Normal Attack Critical Hit', value: '2' },
      ],
    },
    {
      level: 73,
      effects: [
        { name: 'HP Potion Healing Increase Rate', value: '1.5%' },
        { name: 'HP Regen', value: '2' },
      ],
    },
    {
      level: 74,
      effects: [
        { name: 'Monster Evasion', value: '25' },
        { name: 'Normal Attack Accuracy', value: '8' },
      ],
    },
    {
      level: 75,
      effects: [
        { name: 'Normal Attack Evasion', value: '25' },
        { name: 'Attack Power against Monsters', value: '5' },
      ],
    },
    {
      level: 76,
      effects: [
        { name: 'Monster Defense', value: '30' },
        { name: 'Accuracy against Monsters', value: '5' },
      ],
    },
    { level: 77, effects: [{ name: 'MP Regen', value: '10' }] },
    { level: 79, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 80, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

// --- PAGE 2 ---
export const PAGE_TWO_DEF: PageDefinition = {
  page: 2,
  goalStars: 65,
  defaultSelectedCellId: 'G',
  storageKey: 'awakening_p2_board',
  cells: [
    { id: 'A', x: 710, y: 470, kind: 'sword' },
    { id: 'B', x: 1212, y: 470, kind: 'shield' },
    { id: 'C', x: 772, y: 580, kind: 'drop' },
    { id: 'D', x: 897, y: 580, kind: 'sword' },
    { id: 'E', x: 1148, y: 580, kind: 'drop' },
    { id: 'F', x: 835, y: 690, kind: 'drop' },
    { id: 'G', x: 961, y: 690, kind: 'drop', isCenter: true },
    { id: 'H', x: 1086, y: 690, kind: 'drop' },
    { id: 'I', x: 772, y: 800, kind: 'drop' },
    { id: 'J', x: 1023, y: 800, kind: 'shield' },
    { id: 'K', x: 1148, y: 800, kind: 'drop' },
    { id: 'L', x: 710, y: 910, kind: 'sword' },
    { id: 'M', x: 1212, y: 910, kind: 'shield' },
  ],
  thresholds: [
    { level: 12, effects: [{ name: 'Basic Attack', value: '5' }] },
    { level: 23, effects: [{ name: 'Skill Defense', value: '5' }] },
    { level: 28, effects: [{ name: 'Basic Attack Defense', value: '5' }] },
    { level: 33, effects: [{ name: 'Skill Attack', value: '5' }] },
    { level: 37, effects: [{ name: 'Normal Attack Accuracy', value: '5' }] },
    { level: 41, effects: [{ name: 'Increase HP Potion Healing', value: '2%' }] },
    { level: 44, effects: [{ name: 'Normal Attack Accuracy', value: '10' }] },
    { level: 47, effects: [{ name: 'Skill Evasion', value: '10' }] },
    { level: 50, effects: [{ name: 'Normal Attack Evasion', value: '10' }] },
    { level: 53, effects: [{ name: 'Skill Accuracy', value: '10' }] },
    { level: 56, effects: [{ name: 'Basic Attack', value: '15' }] },
    {
      level: 58,
      effects: [
        { name: 'Skill Attack', value: '20' },
        { name: 'Skill Accuracy', value: '5' },
      ],
    },
    {
      level: 60,
      effects: [
        { name: 'Player Defense', value: '20' },
        { name: 'Skill Attack', value: '5' },
      ],
    },
    {
      level: 62,
      effects: [
        { name: 'Basic Attack Defense', value: '25' },
        { name: 'Normal Attack Evasion', value: '5' },
      ],
    },
    { level: 63, effects: [{ name: 'Skill Defense', value: '25' }] },
    { level: 64, effects: [{ name: 'Awakening Milestone', value: '64★' }] },
    { level: 65, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

// --- PAGE 3 ---
export const PAGE_THREE_DEF: PageDefinition = {
  page: 3,
  goalStars: 109,
  defaultSelectedCellId: 'J',
  storageKey: 'awakening_p3_board_v2',
  cells: [
    { id: 'A', x: 710, y: 250, kind: 'sword' },
    { id: 'B', x: 835, y: 250, kind: 'sword' },
    { id: 'C', x: 1086, y: 250, kind: 'drop' },
    { id: 'D', x: 1212, y: 250, kind: 'shield' },
    { id: 'E', x: 647, y: 360, kind: 'shield' },
    { id: 'F', x: 898, y: 360, kind: 'sword' },
    { id: 'G', x: 1023, y: 360, kind: 'drop' },
    { id: 'H', x: 1274, y: 360, kind: 'drop' },
    { id: 'I', x: 710, y: 470, kind: 'shield' },
    { id: 'J', x: 835, y: 470, kind: 'sword', isCenter: true },
    { id: 'K', x: 1086, y: 470, kind: 'shield', isCenter: true },
    { id: 'L', x: 1212, y: 470, kind: 'drop' },
    { id: 'M', x: 772, y: 580, kind: 'drop' },
    { id: 'N', x: 1149, y: 580, kind: 'drop' },
    { id: 'O', x: 835, y: 690, kind: 'sword' },
    { id: 'P', x: 961, y: 690, kind: 'drop' },
    { id: 'Q', x: 1086, y: 690, kind: 'drop' },
    { id: 'R', x: 898, y: 800, kind: 'drop' },
    { id: 'S', x: 1023, y: 800, kind: 'shield' },
  ],
  thresholds: [
    { level: 20, effects: [{ name: 'Attack Power against Monsters', value: '5' }] },
    { level: 33, effects: [{ name: 'Basic Attack Defense', value: '5' }] },
    { level: 39, effects: [{ name: 'Attack Power against Players', value: '5' }] },
    { level: 43, effects: [{ name: 'Monster Critical Hit Resistance', value: '3' }] },
    { level: 47, effects: [{ name: 'Accuracy', value: '5' }] },
    { level: 51, effects: [{ name: 'Monster Evasion', value: '5' }] },
    { level: 54, effects: [{ name: 'Normal Attack Accuracy', value: '5' }] },
    { level: 58, effects: [{ name: 'Attack Power against Monsters', value: '5' }] },
    { level: 60, effects: [{ name: 'Basic Attack', value: '5' }] },
    { level: 63, effects: [{ name: 'MP Regen', value: '2' }] },
    { level: 66, effects: [{ name: 'Critical Hit against Monsters', value: '5' }] },
    { level: 68, effects: [{ name: 'Basic Attack', value: '10' }] },
    { level: 71, effects: [{ name: 'Increase HP Potion Healing', value: '3%' }] },
    { level: 73, effects: [{ name: 'Attack Power against Monsters', value: '15' }] },
    { level: 75, effects: [{ name: 'Evasion', value: '15' }] },
    { level: 78, effects: [{ name: 'Player Evasion', value: '15' }] },
    { level: 80, effects: [{ name: 'Skill Attack', value: '15' }] },
    { level: 82, effects: [{ name: 'Accuracy against Monsters', value: '15' }] },
    { level: 84, effects: [{ name: 'Evasion', value: '15' }] },
    { level: 86, effects: [{ name: 'MP Regen', value: '5' }] },
    { level: 88, effects: [{ name: 'Monster Defense', value: '20' }] },
    {
      level: 89,
      effects: [
        { name: 'Basic Attack Defense', value: '20' },
        { name: 'Monster Critical Hit Resistance', value: '2' },
      ],
    },
    {
      level: 91,
      effects: [
        { name: 'Accuracy against Players', value: '20' },
        { name: 'Player Defense', value: '5' },
      ],
    },
    { level: 93, effects: [{ name: 'Skill Defense', value: '25' }] },
    {
      level: 95,
      effects: [
        { name: 'MP Regen', value: '5' },
        { name: 'Normal Attack Accuracy', value: '5' },
      ],
    },
    {
      level: 97,
      effects: [
        { name: 'Skill Accuracy', value: '30' },
        { name: 'Accuracy against Players', value: '5' },
      ],
    },
    {
      level: 98,
      effects: [
        { name: 'Increase HP Potion Healing', value: '5%' },
        { name: 'Skill Evasion', value: '10' },
      ],
    },
    {
      level: 100,
      effects: [
        { name: 'Skill Evasion', value: '35' },
        { name: 'Basic Attack', value: '10' },
      ],
    },
    {
      level: 102,
      effects: [
        { name: 'Normal Attack Accuracy', value: '35' },
        { name: 'Increase HP Potion Healing', value: '3%' },
      ],
    },
    {
      level: 103,
      effects: [
        { name: 'Accuracy', value: '35' },
        { name: 'Evasion', value: '10' },
      ],
    },
    {
      level: 105,
      effects: [
        { name: 'Attack Power against Players', value: '45' },
        { name: 'Player Evasion', value: '10' },
      ],
    },
    {
      level: 106,
      effects: [
        { name: 'Normal Attack Evasion', value: '45' },
        { name: 'Skill Attack', value: '10' },
      ],
    },
    { level: 108, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 109, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

// --- PAGE 4 ---
export const PAGE_FOUR_DEF: PageDefinition = {
  page: 4,
  goalStars: 132,
  defaultSelectedCellId: 'T',
  storageKey: 'awakening_p4_board',
  cells: [
    { id: 'A', x: 961, y: 250, kind: 'sword' },
    { id: 'B', x: 1086, y: 250, kind: 'drop' },
    { id: 'C', x: 1212, y: 250, kind: 'sword' },
    { id: 'D', x: 898, y: 360, kind: 'drop' },
    { id: 'E', x: 1149, y: 360, kind: 'shield' },
    { id: 'F', x: 835, y: 470, kind: 'drop' },
    { id: 'G', x: 1086, y: 470, kind: 'drop' },
    { id: 'H', x: 1212, y: 470, kind: 'sword' },
    { id: 'I', x: 1337, y: 470, kind: 'drop' },
    { id: 'J', x: 772, y: 580, kind: 'drop' },
    { id: 'K', x: 1274, y: 580, kind: 'drop' },
    { id: 'L', x: 1400, y: 580, kind: 'sword', isCenter: true },
    { id: 'M', x: 710, y: 690, kind: 'drop' },
    { id: 'N', x: 1337, y: 690, kind: 'shield' },
    { id: 'O', x: 647, y: 800, kind: 'drop' },
    { id: 'P', x: 1274, y: 800, kind: 'shield' },
    { id: 'Q', x: 584, y: 910, kind: 'shield' },
    { id: 'R', x: 710, y: 910, kind: 'shield' },
    { id: 'S', x: 835, y: 910, kind: 'shield' },
    { id: 'T', x: 961, y: 910, kind: 'sword', isCenter: true },
    { id: 'U', x: 1086, y: 910, kind: 'drop' },
    { id: 'V', x: 1212, y: 910, kind: 'shield' },
    { id: 'W', x: 1023, y: 1020, kind: 'sword' },
  ],
  thresholds: [
    { level: 24, effects: [{ name: 'Defense', value: '5' }] },
    { level: 39, effects: [{ name: 'Normal Attack Evasion', value: '5' }] },
    { level: 51, effects: [{ name: 'Basic Attack Defense', value: '5' }] },
    { level: 56, effects: [{ name: 'Skill Defense', value: '5' }] },
    { level: 61, effects: [{ name: 'Critical Hit Resistance', value: '5' }] },
    { level: 66, effects: [{ name: 'Skill Accuracy', value: '5' }] },
    { level: 70, effects: [{ name: 'Normal Attack Critical Hit', value: '5' }] },
    { level: 74, effects: [{ name: 'Attack Power against Monsters', value: '10' }] },
    { level: 78, effects: [{ name: 'Ignore Skill Attack', value: '10' }] },
    { level: 82, effects: [{ name: 'Awakening Milestone', value: '82★' }] },
    { level: 86, effects: [{ name: 'Awakening Milestone', value: '86★' }] },
    { level: 90, effects: [{ name: 'Awakening Milestone', value: '90★' }] },
    { level: 93, effects: [{ name: 'Awakening Milestone', value: '93★' }] },
    { level: 96, effects: [{ name: 'Awakening Milestone', value: '96★' }] },
    { level: 99, effects: [{ name: 'Awakening Milestone', value: '99★' }] },
    { level: 102, effects: [{ name: 'Awakening Milestone', value: '102★' }] },
    { level: 105, effects: [{ name: 'Awakening Milestone', value: '105★' }] },
    { level: 108, effects: [{ name: 'Awakening Milestone', value: '108★' }] },
    { level: 111, effects: [{ name: 'Awakening Milestone', value: '111★' }] },
    { level: 114, effects: [{ name: 'Awakening Milestone', value: '114★' }] },
    { level: 116, effects: [{ name: 'Awakening Milestone', value: '116★' }] },
    { level: 118, effects: [{ name: 'Awakening Milestone', value: '118★' }] },
    { level: 120, effects: [{ name: 'Awakening Milestone', value: '120★' }] },
    { level: 122, effects: [{ name: 'Awakening Milestone', value: '122★' }] },
    { level: 123, effects: [{ name: 'Awakening Milestone', value: '123★' }] },
    { level: 124, effects: [{ name: 'Awakening Milestone', value: '124★' }] },
    { level: 125, effects: [{ name: 'Awakening Milestone', value: '125★' }] },
    { level: 127, effects: [{ name: 'Awakening Milestone', value: '127★' }] },
    { level: 128, effects: [{ name: 'Awakening Milestone', value: '128★' }] },
    { level: 129, effects: [{ name: 'Awakening Milestone', value: '129★' }] },
    { level: 130, effects: [{ name: 'Awakening Milestone', value: '130★' }] },
    { level: 131, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 132, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

// --- PAGE 5 ---
export const PAGE_FIVE_DEF: PageDefinition = {
  page: 5,
  goalStars: 121,
  defaultSelectedCellId: 'D',
  storageKey: 'awakening_p5_board',
  cells: [
    { id: 'A', x: 835, y: 250, kind: 'drop' },
    { id: 'B', x: 961, y: 250, kind: 'sword' },
    { id: 'C', x: 772, y: 360, kind: 'drop' },
    { id: 'D', x: 898, y: 360, kind: 'sword', isCenter: true },
    { id: 'E', x: 1023, y: 360, kind: 'drop' },
    { id: 'F', x: 710, y: 470, kind: 'sword' },
    { id: 'G', x: 1086, y: 470, kind: 'shield' },
    { id: 'H', x: 647, y: 580, kind: 'drop' },
    { id: 'I', x: 772, y: 580, kind: 'shield', isCenter: true },
    { id: 'J', x: 1023, y: 580, kind: 'sword', isCenter: true },
    { id: 'K', x: 1149, y: 580, kind: 'drop' },
    { id: 'L', x: 710, y: 690, kind: 'drop' },
    { id: 'M', x: 1086, y: 690, kind: 'drop' },
    { id: 'N', x: 521, y: 800, kind: 'shield' },
    { id: 'O', x: 772, y: 800, kind: 'drop' },
    { id: 'P', x: 898, y: 800, kind: 'shield', isCenter: true },
    { id: 'Q', x: 1023, y: 800, kind: 'drop' },
    { id: 'R', x: 1274, y: 800, kind: 'drop' },
    { id: 'S', x: 459, y: 910, kind: 'drop' },
    { id: 'T', x: 584, y: 910, kind: 'sword' },
    { id: 'U', x: 710, y: 910, kind: 'drop' },
    { id: 'V', x: 1086, y: 910, kind: 'drop' },
    { id: 'W', x: 1212, y: 910, kind: 'shield' },
    { id: 'X', x: 1337, y: 910, kind: 'drop' },
  ],
  thresholds: [
    { level: 25, effects: [{ name: 'Awakening Milestone', value: '25★' }] },
    { level: 41, effects: [{ name: 'Awakening Milestone', value: '41★' }] },
    { level: 49, effects: [{ name: 'Awakening Milestone', value: '49★' }] },
    { level: 56, effects: [{ name: 'Awakening Milestone', value: '56★' }] },
    { level: 62, effects: [{ name: 'Awakening Milestone', value: '62★' }] },
    { level: 67, effects: [{ name: 'Awakening Milestone', value: '67★' }] },
    { level: 72, effects: [{ name: 'Awakening Milestone', value: '72★' }] },
    { level: 76, effects: [{ name: 'Awakening Milestone', value: '76★' }] },
    { level: 80, effects: [{ name: 'Awakening Milestone', value: '80★' }] },
    { level: 83, effects: [{ name: 'Awakening Milestone', value: '83★' }] },
    { level: 86, effects: [{ name: 'Awakening Milestone', value: '86★' }] },
    { level: 89, effects: [{ name: 'Basic Attack', value: '5' }] },
    { level: 92, effects: [{ name: 'Increase HP Potion Healing', value: '2%' }] },
    { level: 95, effects: [{ name: 'Attack Power against Monsters', value: '10' }] },
    { level: 98, effects: [{ name: 'Evasion', value: '10' }] },
    { level: 101, effects: [{ name: 'Player Evasion', value: '10' }] },
    { level: 104, effects: [{ name: 'Skill Attack', value: '10' }] },
    { level: 107, effects: [{ name: 'Accuracy against Monsters', value: '10' }] },
    { level: 110, effects: [{ name: 'Monster Evasion', value: '10' }] },
    { level: 113, effects: [{ name: 'MP Regen', value: '4' }] },
    { level: 116, effects: [{ name: 'Awakening Milestone', value: '116★' }] },
    { level: 119, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 121, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

// Page 6 Definition based on in-game screenshot & user thresholds
export const PAGE_SIX_DEF: PageDefinition = {
  page: 6,
  goalStars: 179,
  defaultSelectedCellId: 'C',
  storageKey: 'awakening_p6_board',
  cells: [
    // Row 0 (y = 360)
    { id: 'A', x: 521, y: 360, kind: 'sword' },
    { id: 'B', x: 772, y: 360, kind: 'drop' },
    { id: 'C', x: 898, y: 360, kind: 'shield', isCenter: true },
    { id: 'D', x: 1023, y: 360, kind: 'drop' },
    { id: 'E', x: 1274, y: 360, kind: 'shield' },

    // Row 1 (y = 470)
    { id: 'F', x: 459, y: 470, kind: 'sword' },
    { id: 'G', x: 584, y: 470, kind: 'drop' },
    { id: 'H', x: 1212, y: 470, kind: 'drop' },
    { id: 'I', x: 1337, y: 470, kind: 'shield' },

    // Row 2 (y = 580)
    { id: 'J', x: 521, y: 580, kind: 'drop' },
    { id: 'K', x: 772, y: 580, kind: 'drop' },
    { id: 'L', x: 898, y: 580, kind: 'sword', isCenter: true },
    { id: 'M', x: 1023, y: 580, kind: 'drop' },
    { id: 'N', x: 1274, y: 580, kind: 'drop' },

    // Row 3 (y = 690)
    { id: 'O', x: 459, y: 690, kind: 'shield' },
    { id: 'P', x: 584, y: 690, kind: 'sword' },
    { id: 'Q', x: 835, y: 690, kind: 'drop' },
    { id: 'R', x: 961, y: 690, kind: 'drop' },
    { id: 'S', x: 1212, y: 690, kind: 'shield' },
    { id: 'T', x: 1337, y: 690, kind: 'sword' },

    // Row 4 (y = 800)
    { id: 'U', x: 521, y: 800, kind: 'drop' },
    { id: 'V', x: 1274, y: 800, kind: 'drop' },

    // Row 5 (y = 910)
    { id: 'W', x: 584, y: 910, kind: 'shield' },
    { id: 'X', x: 710, y: 910, kind: 'sword', isCenter: true },
    { id: 'Y', x: 1086, y: 910, kind: 'shield', isCenter: true },
    { id: 'Z', x: 1212, y: 910, kind: 'sword' },

    // Row 6 (y = 1020)
    { id: 'AA', x: 647, y: 1020, kind: 'drop' },
    { id: 'AB', x: 772, y: 1020, kind: 'shield' },
    { id: 'AC', x: 898, y: 1020, kind: 'drop' },
    { id: 'AD', x: 1023, y: 1020, kind: 'sword' },
    { id: 'AE', x: 1149, y: 1020, kind: 'drop' },
  ],
  thresholds: [
    { level: 32, effects: [{ name: 'Basic Attack Defense', value: '5' }] },
    { level: 48, effects: [{ name: 'Player Evasion', value: '5' }] },
    { level: 56, effects: [{ name: 'Skill Accuracy', value: '5' }] },
    { level: 64, effects: [{ name: 'Basic Attack', value: '5' }] },
    { level: 71, effects: [{ name: 'Normal Attack Evasion', value: '5' }] },
    { level: 78, effects: [{ name: 'Monster Defense', value: '5' }] },
    { level: 84, effects: [{ name: 'Normal Attack Accuracy', value: '5' }] },
    { level: 90, effects: [{ name: 'Skill Accuracy', value: '5' }] },
    { level: 95, effects: [{ name: 'Critical Hit against Players', value: '5' }] },
    { level: 100, effects: [{ name: 'Awakening Milestone', value: '100★' }] },
    { level: 104, effects: [{ name: 'Awakening Milestone', value: '104★' }] },
    { level: 108, effects: [{ name: 'Awakening Milestone', value: '108★' }] },
    { level: 111, effects: [{ name: 'Awakening Milestone', value: '111★' }] },
    { level: 114, effects: [{ name: 'Awakening Milestone', value: '114★' }] },
    { level: 117, effects: [{ name: 'Awakening Milestone', value: '117★' }] },
    { level: 120, effects: [{ name: 'Awakening Milestone', value: '120★' }] },
    { level: 122, effects: [{ name: 'Awakening Milestone', value: '122★' }] },
    { level: 124, effects: [{ name: 'Awakening Milestone', value: '124★' }] },
    { level: 126, effects: [{ name: 'Awakening Milestone', value: '126★' }] },
    { level: 128, effects: [{ name: 'Awakening Milestone', value: '128★' }] },
    { level: 130, effects: [{ name: 'Awakening Milestone', value: '130★' }] },
    { level: 132, effects: [{ name: 'Awakening Milestone', value: '132★' }] },
    { level: 134, effects: [{ name: 'Awakening Milestone', value: '134★' }] },
    { level: 136, effects: [{ name: 'Awakening Milestone', value: '136★' }] },
    { level: 138, effects: [{ name: 'Awakening Milestone', value: '138★' }] },
    { level: 140, effects: [{ name: 'Awakening Milestone', value: '140★' }] },
    { level: 142, effects: [{ name: 'Awakening Milestone', value: '142★' }] },
    { level: 144, effects: [{ name: 'Awakening Milestone', value: '144★' }] },
    { level: 146, effects: [{ name: 'Awakening Milestone', value: '146★' }] },
    { level: 148, effects: [{ name: 'Awakening Milestone', value: '148★' }] },
    { level: 150, effects: [{ name: 'Awakening Milestone', value: '150★' }] },
    { level: 152, effects: [{ name: 'Awakening Milestone', value: '152★' }] },
    { level: 154, effects: [{ name: 'Awakening Milestone', value: '154★' }] },
    { level: 156, effects: [{ name: 'Awakening Milestone', value: '156★' }] },
    { level: 158, effects: [{ name: 'Awakening Milestone', value: '158★' }] },
    { level: 160, effects: [{ name: 'Awakening Milestone', value: '160★' }] },
    { level: 162, effects: [{ name: 'Awakening Milestone', value: '162★' }] },
    { level: 164, effects: [{ name: 'Awakening Milestone', value: '164★' }] },
    { level: 166, effects: [{ name: 'Awakening Milestone', value: '166★' }] },
    { level: 168, effects: [{ name: 'Awakening Milestone', value: '168★' }] },
    { level: 169, effects: [{ name: 'Awakening Milestone', value: '169★' }] },
    { level: 170, effects: [{ name: 'Awakening Milestone', value: '170★' }] },
    { level: 171, effects: [{ name: 'Awakening Milestone', value: '171★' }] },
    { level: 172, effects: [{ name: 'Awakening Milestone', value: '172★' }] },
    { level: 173, effects: [{ name: 'Awakening Milestone', value: '173★' }] },
    { level: 174, effects: [{ name: 'Awakening Milestone', value: '174★' }] },
    { level: 175, effects: [{ name: 'Awakening Milestone', value: '175★' }] },
    { level: 176, effects: [{ name: 'Awakening Milestone', value: '176★' }] },
    { level: 178, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] },
    { level: 179, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] },
  ],
};

export const PAGE_SIX_DRAFT = PAGE_SIX_DEF;

/* =========================================================================
   PAGE REGISTRY
   To add Page 6, 7, 8... simply append the new page definition to RAW_PAGES!
   Everything else in the app (dropdown, navigation, storage, reset, simulation)
   will adapt automatically with ZERO changes needed in App.tsx!
   ========================================================================= */

export const RAW_PAGES: PageDefinition[] = [
  PAGE_ONE_DEF,
  PAGE_TWO_DEF,
  PAGE_THREE_DEF,
  PAGE_FOUR_DEF,
  PAGE_FIVE_DEF,
  PAGE_SIX_DEF,
];

export function getEffectiveRawPages(): PageDefinition[] {
  const custom = loadCustomPages();
  const map = new Map<number, PageDefinition>();
  for (const p of RAW_PAGES) {
    map.set(p.page, p);
  }
  for (const cp of custom) {
    map.set(cp.page, cp);
  }
  return Array.from(map.values()).sort((a, b) => a.page - b.page);
}

export function getEffectivePages(): ProcessedPageConfig[] {
  return getEffectiveRawPages().map(processPageDefinition);
}

export const PAGES: ProcessedPageConfig[] = RAW_PAGES.map(processPageDefinition);

export const PAGES_BY_NUM: Record<number, ProcessedPageConfig> = Object.fromEntries(
  PAGES.map((p) => [p.page, p]),
);

export const MIN_PAGE = PAGES[0]?.page ?? 1;
export const MAX_PAGE = PAGES[PAGES.length - 1]?.page ?? 6;
export const TOTAL_PAGES_IN_GAME = 17;
export const READY_PAGES_COUNT = PAGES.length;

/* =========================================================================
   CUSTOM PAGES STORAGE & PAGE BUILDER UTILITIES
   ========================================================================= */

export const CUSTOM_PAGES_STORAGE_KEY = 'awakening_custom_pages';

export function loadCustomPages(): PageDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPage(def: PageDefinition): void {
  try {
    const current = loadCustomPages().filter((p) => p.page !== def.page);
    current.push(def);
    current.sort((a, b) => a.page - b.page);
    localStorage.setItem(CUSTOM_PAGES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save custom page:', err);
  }
}

export function deleteCustomPage(pageNum: number): void {
  try {
    const current = loadCustomPages().filter((p) => p.page !== pageNum);
    localStorage.setItem(CUSTOM_PAGES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to delete custom page:', err);
  }
}

/**
 * Assigns clean IDs ('A'..'Z', 'AA'..'AZ') sorted by Row (Y ascending) then Col (X ascending).
 */
export function autoAssignCellIds(cells: CellDef[]): CellDef[] {
  const sorted = [...cells].sort((a, b) => {
    // Group rows within 20px
    const rowDiff = a.y - b.y;
    if (Math.abs(rowDiff) > 20) return rowDiff;
    return a.x - b.x;
  });

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return sorted.map((cell, idx) => {
    const newId = idx < 26 ? letters[idx] : `A${letters[idx - 26]}`;
    return {
      ...cell,
      id: newId,
    };
  });
}

/**
 * Parses space/comma/newline-separated threshold numbers, auto-splitting joined numbers like "95100".
 */
export function parseThresholdsInput(rawText: string): Threshold[] {
  if (!rawText.trim()) return [];

  // Match all integer chunks
  const tokens = rawText.match(/\d+/g) ?? [];
  const numbers: number[] = [];

  for (const token of tokens) {
    const num = parseInt(token, 10);
    // Check if user accidentally pasted joined numbers like "95100" (e.g. 95 and 100)
    if (token.length >= 4 && num > 200) {
      // Try split into two 2/3-digit numbers
      const mid = Math.floor(token.length / 2);
      const n1 = parseInt(token.slice(0, mid), 10);
      const n2 = parseInt(token.slice(mid), 10);
      if (n1 > 0 && n2 > n1 && n2 <= 200) {
        numbers.push(n1, n2);
        continue;
      }
    }
    if (!Number.isNaN(num) && num > 0) {
      numbers.push(num);
    }
  }

  // Deduplicate and sort ascending
  const uniqueSorted = Array.from(new Set(numbers)).sort((a, b) => a - b);
  if (uniqueSorted.length === 0) return [];

  const maxLevel = uniqueSorted[uniqueSorted.length - 1];

  return uniqueSorted.map((level) => {
    if (level === maxLevel) {
      return { level, effects: [{ name: 'Final Awakening Milestone', value: 'Max' }] };
    }
    if (level === uniqueSorted[uniqueSorted.length - 2]) {
      return { level, effects: [{ name: 'Bonus Awakening Attributes', value: 'Unlocked' }] };
    }
    return { level, effects: [{ name: 'Awakening Milestone', value: `${level}★` }] };
  });
}

/**
 * Generates formatted TypeScript code ready to be pasted into src/pagesData.ts.
 */
export function generateTypeScriptCode(def: PageDefinition): string {
  const pageWord = [
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN'
  ][def.page - 1] ?? `PAGE_${def.page}`;

  const cellsCode = def.cells
    .map(
      (c) =>
        `    { id: '${c.id}', x: ${c.x}, y: ${c.y}, kind: '${c.kind}'${
          c.defaultStar ? `, defaultStar: ${c.defaultStar}` : ''
        }${c.isCenter ? ', isCenter: true' : ''} },`,
    )
    .join('\n');

  const finalGoal = def.goalStars > 0 ? def.goalStars : def.cells.length * 6;
  const thresholdsToUse =
    def.thresholds && def.thresholds.length > 0
      ? def.thresholds
      : [
          {
            level: finalGoal,
            effects: [{ name: 'Max Possible Awakening', value: `${finalGoal}★ (All 6★)` }],
          },
        ];

  const thresholdsCode = thresholdsToUse
    .map(
      (t) =>
        `    { level: ${t.level}, effects: ${JSON.stringify(t.effects)} },`,
    )
    .join('\n');

  return `// --- PAGE ${def.page} ---
export const PAGE_${pageWord}_DEF: PageDefinition = {
  page: ${def.page},
  goalStars: ${finalGoal},
  defaultSelectedCellId: '${def.defaultSelectedCellId || (def.cells.find((c) => c.isCenter)?.id ?? def.cells[0]?.id ?? 'A')}',
  storageKey: 'awakening_p${def.page}_board',
  cells: [
${cellsCode}
  ],
  thresholds: [
${thresholdsCode}
  ],
};`;
}


