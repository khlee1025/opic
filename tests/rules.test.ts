import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDeterministicRules,
  detectRuleIssues,
  MAX_RULE_ISSUES,
} from "../app/lib/rules.ts";
import {
  createCoachAutosaver,
  createEmptyCoachState,
  createQuestionAttempt,
  exportCoachState,
  getCurrentStreak,
  getDailyCompletedCount,
  getLongestStreak,
  getSeoulDateKey,
  importCoachStateJson,
  isDailyGoalComplete,
  loadCoachState,
  saveCoachState,
  type StorageLike,
  upsertQuestionAttempt,
} from "../app/lib/storage.ts";
import type { CoachState, QuestionAttempt } from "../app/lib/types.ts";

const regressionCases = [
  {
    name: "promise is rendered as plans",
    draft: "I had a promise with my friend.",
    original: "had a promise with my friend",
    suggestion: "had plans with my friend",
    corrected: "I had plans with my friend.",
  },
  {
    name: "adult social time uses hang out",
    draft: "I play with my friends at a cafe.",
    original: "play with my friends",
    suggestion: "hang out with my friends",
    corrected: "I hang out with my friends at a cafe.",
  },
  {
    name: "home does not take to",
    draft: "I went to home around ten.",
    original: "went to home",
    suggestion: "went home",
    corrected: "I went home around ten.",
  },
  {
    name: "physical condition uses feeling well",
    draft: "My condition was bad, so I stayed home.",
    original: "My condition was bad",
    suggestion: "I wasn't feeling well",
    corrected: "I wasn't feeling well, so I stayed home.",
  },
  {
    name: "medicine and rest use natural collocations",
    draft: "I ate medicine and took a rest.",
    original: "ate medicine and took a rest",
    suggestion: "took some medicine and got some rest",
    corrected: "I took some medicine and got some rest.",
  },
  {
    name: "repeated activity uses first time in a long time",
    draft: "I met my college friend after a long time.",
    original: "after a long time",
    suggestion: "for the first time in a long time",
    corrected: "I met my college friend for the first time in a long time.",
  },
  {
    name: "Korean pension lodging becomes vacation rental",
    draft: "We stayed at a pension near the beach.",
    original: "pension",
    suggestion: "vacation rental",
    corrected: "We stayed at a vacation rental near the beach.",
  },
  {
    name: "personal difficulty uses have a hard time",
    draft: "I am difficult to wake up early.",
    original: "I am difficult to wake up early",
    suggestion: "I have a hard time waking up early",
    corrected: "I have a hard time waking up early.",
  },
  {
    name: "a person feels uncomfortable",
    draft: "I was inconvenient during the meeting.",
    original: "I was inconvenient",
    suggestion: "I felt uncomfortable",
    corrected: "I felt uncomfortable during the meeting.",
  },
  {
    name: "recommend takes a gerund",
    draft: "I recommend you to visit this park.",
    original: "I recommend you to visit",
    suggestion: "I'd recommend visiting",
    corrected: "I'd recommend visiting this park.",
  },
] as const;

for (const regression of regressionCases) {
  test(regression.name, () => {
    const issues = detectRuleIssues(regression.draft);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].original, regression.original);
    assert.equal(issues[0].suggestion, regression.suggestion);
    assert.equal(
      regression.draft.slice(issues[0].start, issues[0].end),
      regression.original,
      "reported indices must point to the exact bad span",
    );
    assert.equal(applyDeterministicRules(regression.draft), regression.corrected);
    assert.ok(issues[0].explanationKo.length <= 80);
    assert.ok((issues[0].explanationKo.match(/[.!?。]/g) ?? []).length <= 2);
  });
}

test("does not confuse playing with children with adult socializing", () => {
  assert.deepEqual(detectRuleIssues("I play with my children every evening."), []);
});

test("does not rewrite legitimate pension, time, or description meanings", () => {
  assert.deepEqual(
    detectRuleIssues("My grandfather receives a monthly pension."),
    [],
  );
  assert.deepEqual(
    detectRuleIssues("After a long time, the negotiations finally ended."),
    [],
  );
  assert.deepEqual(detectRuleIssues("I am difficult to understand."), []);
});

test("uses the Korean plan only to disambiguate lodging", () => {
  const plan = {
    answer: "제주도 펜션에서 묵었다.",
    reason: "가족 여행이었다.",
    example: "바다가 가까웠다.",
    closing: "다시 가고 싶다.",
  };
  const issues = detectRuleIssues("The pension was close to the beach.", plan);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].suggestion, "vacation rental");
});

test("returns no more than three prioritized issues", () => {
  const draft = [
    "I went to home.",
    "I am difficult to wake up early.",
    "I recommend you to visit the park.",
    "I had a promise with my friend.",
    "I play with my friends at a cafe.",
  ].join(" ");
  const issues = detectRuleIssues(draft);
  assert.equal(issues.length, MAX_RULE_ISSUES);
  assert.deepEqual(
    issues.map((issue) => issue.priority),
    [1, 1, 1],
  );
});

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function completedAttempt(questionId: string, iso: string): QuestionAttempt {
  return {
    ...createQuestionAttempt(questionId, new Date(iso)),
    stage: "completed",
    completedAt: iso,
  };
}

function completeDay(state: CoachState, dateKey: string): CoachState {
  const iso = `${dateKey}T12:00:00.000Z`;
  const first = upsertQuestionAttempt(
    state,
    dateKey,
    completedAttempt(`${dateKey}-q1`, iso),
    new Date(iso),
  );
  return upsertQuestionAttempt(
    first,
    dateKey,
    completedAttempt(`${dateKey}-q2`, iso),
    new Date(iso),
  );
}

test("Seoul date keys do not accidentally use UTC dates", () => {
  assert.equal(getSeoulDateKey(new Date("2026-07-14T15:30:00.000Z")), "2026-07-15");
  assert.equal(getSeoulDateKey(new Date("2026-07-14T14:59:59.000Z")), "2026-07-14");
});

test("saves, loads, exports, and imports answers locally", () => {
  const storage = new MemoryStorage();
  const now = new Date("2026-07-15T01:00:00.000Z");
  let state = createEmptyCoachState(now);
  const attempt = {
    ...createQuestionAttempt("home-01", now),
    stage: "korean_completed" as const,
    koreanPlan: {
      answer: "집에서 쉰다.",
      reason: "조용해서 좋다.",
      example: "영화를 본다.",
      closing: "충전된다.",
    },
    englishDraft: "I usually rest at home.",
  };
  state = upsertQuestionAttempt(state, "2026-07-15", attempt, now);

  assert.equal(saveCoachState(state, storage, now), true);
  const loaded = loadCoachState(storage, now);
  assert.equal(
    loaded.days["2026-07-15"].attempts["home-01"].koreanPlan.answer,
    "집에서 쉰다.",
  );
  const imported = importCoachStateJson(exportCoachState(loaded, now), now);
  assert.equal(
    imported.days["2026-07-15"].attempts["home-01"].englishDraft,
    "I usually rest at home.",
  );
});

test("autosaver can be flushed synchronously", () => {
  const storage = new MemoryStorage();
  const now = new Date("2026-07-15T01:00:00.000Z");
  const autosaver = createCoachAutosaver({ storage, delayMs: 10_000 });
  autosaver.schedule(createEmptyCoachState(now));
  assert.equal(autosaver.flush(), true);
  assert.equal(loadCoachState(storage, now).version, 1);
});

test("daily completion is exactly two and streak keeps yesterday until today is done", () => {
  let state = createEmptyCoachState(new Date("2026-07-15T01:00:00.000Z"));
  state = completeDay(state, "2026-07-12");
  state = completeDay(state, "2026-07-13");
  state = completeDay(state, "2026-07-14");
  state = upsertQuestionAttempt(
    state,
    "2026-07-15",
    completedAttempt("2026-07-15-q1", "2026-07-15T01:00:00.000Z"),
  );

  assert.equal(getDailyCompletedCount(state, "2026-07-15"), 1);
  assert.equal(isDailyGoalComplete(state, "2026-07-15"), false);
  assert.equal(getCurrentStreak(state, "2026-07-15"), 3);
  assert.equal(getLongestStreak(state), 3);

  state = upsertQuestionAttempt(
    state,
    "2026-07-15",
    completedAttempt("2026-07-15-q2", "2026-07-15T02:00:00.000Z"),
  );
  assert.equal(isDailyGoalComplete(state, "2026-07-15"), true);
  assert.equal(getCurrentStreak(state, "2026-07-15"), 4);
  assert.equal(getLongestStreak(state), 4);
});
