export const UNIVERSAL_TIME_SETTING = "universalTimeState";
export const UNION_EPOCH_MS = Date.UTC(5016, 8, 3, 10, 38, 0, 0);
export const UNION_EPOCH_WEEKDAY_INDEX = 5; // Friday, with Sunday = 0.
export const DAY_MS = 86_400_000;

export const DEFAULT_UNIVERSAL_TIME_STATE = Object.freeze({
  baseMs: UNION_EPOCH_MS,
  anchorRealMs: 0,
  running: true,
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;
const pad2 = (value) => String(value).padStart(2, "0");

export function normalizeUniversalTimeState(state) {
  const source = state && typeof state === "object" ? state : DEFAULT_UNIVERSAL_TIME_STATE;
  const baseMs = Number(source.baseMs);
  const anchorRealMs = Number(source.anchorRealMs);
  return {
    baseMs: Number.isFinite(baseMs) ? baseMs : UNION_EPOCH_MS,
    anchorRealMs: Number.isFinite(anchorRealMs) && anchorRealMs > 0 ? anchorRealMs : 0,
    running: source.running !== false,
  };
}

export function currentUniversalTimeMs(state, realNowMs = Date.now()) {
  const normalized = normalizeUniversalTimeState(state);
  if (!normalized.running || normalized.anchorRealMs <= 0) return normalized.baseMs;
  return normalized.baseMs + Math.max(0, Number(realNowMs) - normalized.anchorRealMs);
}

export function settleUniversalTimeState(state, realNowMs = Date.now()) {
  const normalized = normalizeUniversalTimeState(state);
  return {
    baseMs: currentUniversalTimeMs(normalized, realNowMs),
    anchorRealMs: Number(realNowMs),
    running: normalized.running,
  };
}

export function resumeUniversalTimeSession(state, realNowMs = Date.now()) {
  const normalized = normalizeUniversalTimeState(state);
  const now = Number(realNowMs);
  return {
    ...normalized,
    anchorRealMs: Number.isFinite(now) ? now : Date.now(),
  };
}

export function setUniversalTimeRunning(state, running, realNowMs = Date.now()) {
  const settled = settleUniversalTimeState(state, realNowMs);
  return { ...settled, running: Boolean(running) };
}

export function adjustUniversalTime(state, deltaMs, realNowMs = Date.now()) {
  const settled = settleUniversalTimeState(state, realNowMs);
  return { ...settled, baseMs: settled.baseMs + Number(deltaMs || 0) };
}

export function makeUniversalTimeMs({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  const values = [year, month, day, hour, minute, second].map(Number);
  if (!values.every(Number.isInteger)) throw new Error("Date and time values must be whole numbers.");
  const [y, m, d, h, min, sec] = values;
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) {
    throw new Error("Date or time is outside the supported range.");
  }
  const result = Date.UTC(y, m - 1, d, h, min, sec, 0);
  const check = new Date(result);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error("That date does not exist in the Union calendar.");
  }
  return result;
}

export function setUniversalDateTime(state, parts, realNowMs = Date.now()) {
  const normalized = normalizeUniversalTimeState(state);
  return {
    baseMs: makeUniversalTimeMs(parts),
    anchorRealMs: Number(realNowMs),
    running: normalized.running,
  };
}

export function universalTimeParts(ms) {
  const date = new Date(Number(ms));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

export function unionWeekdayIndex(ms) {
  const current = universalTimeParts(ms);
  const currentMidnight = Date.UTC(current.year, current.month - 1, current.day);
  const epochMidnight = Date.UTC(5016, 8, 3);
  const elapsedDays = Math.round((currentMidnight - epochMidnight) / DAY_MS);
  return positiveModulo(UNION_EPOCH_WEEKDAY_INDEX + elapsedDays, 7);
}

export function formatUniversalDate(ms) {
  const parts = universalTimeParts(ms);
  return `${WEEKDAY_NAMES[unionWeekdayIndex(ms)]}, ${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year} U`;
}

export function formatUniversalClock(ms) {
  const parts = universalTimeParts(ms);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatUniversalTimeInput(ms) {
  const parts = universalTimeParts(ms);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}
