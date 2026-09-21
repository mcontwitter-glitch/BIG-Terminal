/** Real full agents on BIG NETWORK (0-based HUD ids: BIGFOOT#NNNN → id NNNN-1). */

const RED_DISPLAY = [
  31, 79, 115, 122, 123, 145, 180, 185, 197, 213, 217, 231, 307, 319, 327, 353,
  356, 389, 401, 405, 415, 419, 434, 471, 494,
] as const;

const WHITE_DISPLAY = [
  4, 5, 7, 10, 17, 18, 21, 23, 27, 29, 30, 37, 41, 45, 49, 57, 61, 69, 71, 73,
  77, 95, 101, 109, 117, 129, 130, 131, 137, 141, 155, 157, 161, 169, 181,
] as const;

export const REAL_RED_IDS: readonly number[] = RED_DISPLAY.map((n) => n - 1);
export const REAL_WHITE_IDS: readonly number[] = WHITE_DISPLAY.map((n) => n - 1);

export const REAL_AGENT_IDS: readonly number[] = [
  ...REAL_RED_IDS,
  ...REAL_WHITE_IDS,
];

export const REAL_AGENT_NAMES: readonly string[] = REAL_AGENT_IDS.map(
  (id) => `BIGFOOT#${String(id + 1).padStart(4, '0')}`,
);

const REAL_SET = new Set(REAL_AGENT_IDS);
const RED_SET = new Set(REAL_RED_IDS);
const WHITE_SET = new Set(REAL_WHITE_IDS);

export type RealAgentTier = 'red' | 'white';

export function isRealAgent(id: number): boolean {
  return REAL_SET.has(id);
}

export function getRealAgentTier(id: number): RealAgentTier | null {
  if (RED_SET.has(id)) return 'red';
  if (WHITE_SET.has(id)) return 'white';
  return null;
}

export const REAL_AGENT_COUNT = REAL_AGENT_IDS.length;
