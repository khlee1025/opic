import {
  COACH_STATE_VERSION,
  DAILY_QUESTION_GOAL,
  type CoachExportEnvelope,
  type CoachFeedback,
  type CoachIssue,
  type CoachState,
  type DailyPractice,
  type IntentCoverage,
  type KoreanPlan,
  type PracticeStage,
  type QuestionAttempt,
} from "./types.ts";

export const COACH_STORAGE_KEY = "opic-daily-coach.state.v1";
export const SEOUL_TIME_ZONE = "Asia/Seoul";
const MAX_IMPORT_BYTES = 5_000_000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STAGES: ReadonlySet<PracticeStage> = new Set([
  "not_started",
  "question_seen",
  "korean_completed",
  "draft_submitted",
  "feedback_ready",
  "rewrite_submitted",
  "completed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 60_000): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, maxItems)
    .map((item) => item.slice(0, 2_000));
}

function nowIso(now: Date): string {
  return Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
}

/** Returns a YYYY-MM-DD key based on Korean civil time, never UTC. */
export function getSeoulDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftDateKey(dateKey: string, dayOffset: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("날짜 키는 YYYY-MM-DD 형식이어야 합니다.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset, 12));
  return [
    shifted.getUTCFullYear().toString().padStart(4, "0"),
    (shifted.getUTCMonth() + 1).toString().padStart(2, "0"),
    shifted.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function emptyKoreanPlan(): KoreanPlan {
  return { answer: "", reason: "", example: "", closing: "" };
}

export function createEmptyCoachState(now = new Date()): CoachState {
  const timestamp = nowIso(now);
  return {
    version: COACH_STATE_VERSION,
    profile: { selectedInterestIds: [], surveyAnswers: {} },
    settings: { targetLevel: "AL", dailyGoal: DAILY_QUESTION_GOAL },
    days: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function cleanPlan(value: unknown): KoreanPlan {
  const plan = isRecord(value) ? value : {};
  return {
    answer: cleanString(plan.answer),
    reason: cleanString(plan.reason),
    example: cleanString(plan.example),
    closing: cleanString(plan.closing),
  };
}

function cleanIssue(value: unknown, index: number): CoachIssue | null {
  if (!isRecord(value)) return null;
  const priority = value.priority === 1 || value.priority === 2 ? value.priority : 3;
  const categories = ["meaning", "grammar", "word_choice", "naturalness"];
  const category = categories.includes(String(value.category))
    ? (value.category as CoachIssue["category"])
    : "naturalness";

  return {
    id: cleanString(value.id, 200) || `saved-issue-${index}`,
    source: value.source === "rule" ? "rule" : "local_ai",
    category,
    priority,
    original: cleanString(value.original),
    suggestion: cleanString(value.suggestion),
    explanationKo: cleanString(value.explanationKo),
    ...(typeof value.start === "number" && Number.isSafeInteger(value.start)
      ? { start: Math.max(0, value.start) }
      : {}),
    ...(typeof value.end === "number" && Number.isSafeInteger(value.end)
      ? { end: Math.max(0, value.end) }
      : {}),
    ...(typeof value.ruleId === "string"
      ? { ruleId: cleanString(value.ruleId, 200) }
      : {}),
  };
}

function cleanCoverage(value: unknown): IntentCoverage {
  const coverage = isRecord(value) ? value : {};
  return {
    answer: coverage.answer === true,
    reason: coverage.reason === true,
    example: coverage.example === true,
    closing: coverage.closing === true,
  };
}

function cleanFeedback(value: unknown): CoachFeedback | undefined {
  if (!isRecord(value)) return undefined;
  const issues = Array.isArray(value.issues)
    ? value.issues
        .map((issue, index) => cleanIssue(issue, index))
        .filter((issue): issue is CoachIssue => issue !== null)
        .slice(0, 20)
    : [];
  const phraseUpgrades = Array.isArray(value.phraseUpgrades)
    ? value.phraseUpgrades
        .filter(isRecord)
        .slice(0, 20)
        .map((upgrade) => ({
          from: cleanString(upgrade.from),
          to: cleanString(upgrade.to),
          whyKo: cleanString(upgrade.whyKo),
        }))
    : undefined;

  return {
    source: value.source === "local-model" ? "local-model" : "rules-only",
    modelUsed:
      typeof value.modelUsed === "string"
        ? cleanString(value.modelUsed, 200)
        : null,
    diagnosisKo: cleanString(value.diagnosisKo),
    intentCoverage: cleanCoverage(value.intentCoverage),
    issues,
    rewriteTargets: cleanStringArray(value.rewriteTargets, 20),
    ...(typeof value.correctedEnglish === "string"
      ? { correctedEnglish: cleanString(value.correctedEnglish) }
      : {}),
    ...(typeof value.naturalEnglish === "string"
      ? { naturalEnglish: cleanString(value.naturalEnglish) }
      : {}),
    ...(typeof value.modelAnswer === "string"
      ? { modelAnswer: cleanString(value.modelAnswer) }
      : {}),
    ...(typeof value.stretchAnswer === "string"
      ? { stretchAnswer: cleanString(value.stretchAnswer) }
      : {}),
    ...(phraseUpgrades ? { phraseUpgrades } : {}),
    ...(typeof value.nextTaskKo === "string"
      ? { nextTaskKo: cleanString(value.nextTaskKo) }
      : {}),
  };
}

function cleanAttempt(questionId: string, value: unknown, now: Date): QuestionAttempt {
  const attempt = isRecord(value) ? value : {};
  const stage = STAGES.has(attempt.stage as PracticeStage)
    ? (attempt.stage as PracticeStage)
    : "not_started";
  const fallbackTime = nowIso(now);

  return {
    questionId,
    stage,
    koreanPlan: cleanPlan(attempt.koreanPlan),
    englishDraft: cleanString(attempt.englishDraft),
    englishRewrite: cleanString(attempt.englishRewrite),
    ...(cleanFeedback(attempt.feedback)
      ? { feedback: cleanFeedback(attempt.feedback) }
      : {}),
    ...(typeof attempt.startedAt === "string"
      ? { startedAt: cleanString(attempt.startedAt, 100) }
      : {}),
    updatedAt:
      typeof attempt.updatedAt === "string"
        ? cleanString(attempt.updatedAt, 100)
        : fallbackTime,
    ...(typeof attempt.completedAt === "string"
      ? { completedAt: cleanString(attempt.completedAt, 100) }
      : {}),
  };
}

function cleanDay(dateKey: string, value: unknown, now: Date): DailyPractice {
  const day = isRecord(value) ? value : {};
  const rawAttempts = isRecord(day.attempts) ? day.attempts : {};
  const attempts = Object.fromEntries(
    Object.entries(rawAttempts)
      .slice(0, 20)
      .map(([questionId, attempt]) => [
        questionId.slice(0, 300),
        cleanAttempt(questionId.slice(0, 300), attempt, now),
      ]),
  );

  return {
    dateKey,
    questionIds: cleanStringArray(day.questionIds, DAILY_QUESTION_GOAL),
    attempts,
  };
}

export function sanitizeCoachState(value: unknown, now = new Date()): CoachState {
  if (!isRecord(value)) throw new Error("유효한 학습 데이터가 아닙니다.");
  const fallback = createEmptyCoachState(now);
  const rawProfile = isRecord(value.profile) ? value.profile : {};
  const rawSurvey = isRecord(rawProfile.surveyAnswers)
    ? rawProfile.surveyAnswers
    : {};
  const surveyAnswers = Object.fromEntries(
    Object.entries(rawSurvey)
      .slice(0, 100)
      .map(([key, answer]) => [
        key.slice(0, 200),
        Array.isArray(answer)
          ? cleanStringArray(answer, 100)
          : cleanString(answer, 10_000),
      ]),
  );
  const rawDays = isRecord(value.days) ? value.days : {};
  const days = Object.fromEntries(
    Object.entries(rawDays)
      .filter(([dateKey]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
      .slice(0, 2_000)
      .map(([dateKey, day]) => [dateKey, cleanDay(dateKey, day, now)]),
  );
  const settings = isRecord(value.settings) ? value.settings : {};

  return {
    version: COACH_STATE_VERSION,
    profile: {
      selectedInterestIds: cleanStringArray(rawProfile.selectedInterestIds),
      surveyAnswers,
    },
    settings: {
      targetLevel: settings.targetLevel === "IH" ? "IH" : "AL",
      dailyGoal: DAILY_QUESTION_GOAL,
    },
    days,
    createdAt:
      typeof value.createdAt === "string"
        ? cleanString(value.createdAt, 100)
        : fallback.createdAt,
    updatedAt:
      typeof value.updatedAt === "string"
        ? cleanString(value.updatedAt, 100)
        : fallback.updatedAt,
  };
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Loads only from the supplied browser storage; corrupt data fails closed. */
export function loadCoachState(
  storage: StorageLike | undefined = browserStorage(),
  now = new Date(),
): CoachState {
  if (!storage) return createEmptyCoachState(now);
  try {
    const raw = storage.getItem(COACH_STORAGE_KEY);
    return raw ? sanitizeCoachState(JSON.parse(raw), now) : createEmptyCoachState(now);
  } catch {
    return createEmptyCoachState(now);
  }
}

/** Saves to localStorage only and never logs or transmits answer text. */
export function saveCoachState(
  state: CoachState,
  storage: StorageLike | undefined = browserStorage(),
  now = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const safe = sanitizeCoachState({ ...state, updatedAt: nowIso(now) }, now);
    storage.setItem(COACH_STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function clearCoachState(
  storage: StorageLike | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(COACH_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function exportCoachState(state: CoachState, now = new Date()): string {
  const envelope: CoachExportEnvelope = {
    app: "opic-daily-coach",
    exportedAt: nowIso(now),
    data: sanitizeCoachState(state, now),
  };
  return JSON.stringify(envelope, null, 2);
}

export function importCoachStateJson(json: string, now = new Date()): CoachState {
  if (new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES) {
    throw new Error("가져올 파일이 너무 큽니다.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("JSON 파일을 읽을 수 없습니다.");
  }
  if (isRecord(parsed) && parsed.app === "opic-daily-coach" && "data" in parsed) {
    return sanitizeCoachState(parsed.data, now);
  }
  return sanitizeCoachState(parsed, now);
}

export function saveImportedCoachState(
  json: string,
  storage: StorageLike | undefined = browserStorage(),
  now = new Date(),
): CoachState {
  const state = importCoachStateJson(json, now);
  if (!saveCoachState(state, storage, now)) {
    throw new Error("이 브라우저의 로컬 저장소에 저장할 수 없습니다.");
  }
  return state;
}

export interface CoachAutosaver {
  schedule(state: CoachState): void;
  flush(): boolean;
  cancel(): void;
}

export function createCoachAutosaver(options: {
  storage?: StorageLike;
  delayMs?: number;
  onError?: () => void;
} = {}): CoachAutosaver {
  const delayMs = Math.max(100, options.delayMs ?? 500);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: CoachState | undefined;

  const flush = (): boolean => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!pending) return true;
    const state = pending;
    pending = undefined;
    const saved = saveCoachState(state, options.storage);
    if (!saved) options.onError?.();
    return saved;
  };

  return {
    schedule(state) {
      pending = state;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
    },
  };
}

export function createQuestionAttempt(
  questionId: string,
  now = new Date(),
): QuestionAttempt {
  const timestamp = nowIso(now);
  return {
    questionId,
    stage: "not_started",
    koreanPlan: emptyKoreanPlan(),
    englishDraft: "",
    englishRewrite: "",
    updatedAt: timestamp,
  };
}

export function upsertQuestionAttempt(
  state: CoachState,
  dateKey: string,
  attempt: QuestionAttempt,
  now = new Date(),
): CoachState {
  const currentDay = state.days[dateKey] ?? {
    dateKey,
    questionIds: [],
    attempts: {},
  };
  const questionIds = currentDay.questionIds.includes(attempt.questionId)
    ? currentDay.questionIds
    : [...currentDay.questionIds, attempt.questionId].slice(0, DAILY_QUESTION_GOAL);

  return {
    ...state,
    updatedAt: nowIso(now),
    days: {
      ...state.days,
      [dateKey]: {
        ...currentDay,
        questionIds,
        attempts: {
          ...currentDay.attempts,
          [attempt.questionId]: { ...attempt, updatedAt: nowIso(now) },
        },
      },
    },
  };
}

export function getDailyCompletedCount(
  state: CoachState,
  dateKey = getSeoulDateKey(),
): number {
  const attempts = Object.values(state.days[dateKey]?.attempts ?? {});
  return Math.min(
    DAILY_QUESTION_GOAL,
    attempts.filter(
      (attempt) => attempt.stage === "completed" || Boolean(attempt.completedAt),
    ).length,
  );
}

export function isDailyGoalComplete(
  state: CoachState,
  dateKey = getSeoulDateKey(),
): boolean {
  return getDailyCompletedCount(state, dateKey) >= DAILY_QUESTION_GOAL;
}

export function getCurrentStreak(
  state: CoachState,
  todayKey = getSeoulDateKey(),
): number {
  let cursor = isDailyGoalComplete(state, todayKey)
    ? todayKey
    : shiftDateKey(todayKey, -1);
  let streak = 0;

  while (isDailyGoalComplete(state, cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function getLongestStreak(state: CoachState): number {
  const completedDays = Object.keys(state.days)
    .filter((dateKey) => isDailyGoalComplete(state, dateKey))
    .sort();
  let longest = 0;
  let current = 0;
  let previous: string | undefined;

  for (const dateKey of completedDays) {
    current = previous && shiftDateKey(previous, 1) === dateKey ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = dateKey;
  }
  return longest;
}
