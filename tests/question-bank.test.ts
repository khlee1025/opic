import assert from "node:assert/strict";
import test from "node:test";
import type * as QuestionBankModule from "../app/data/questions";

// Keeping the runtime path in a variable lets Node 24 test the TypeScript source
// directly while the type-only import above remains compatible with tsc.
const questionBankSourcePath: string = "../app/data/questions.ts";
const {
  CURRICULUM_ANCHOR_DATE,
  DAILY_QUESTION_SETS,
  QUESTION_BANK,
  QUESTION_BANK_SOURCE_LABEL,
  QUESTION_CATEGORY_IDS,
  QUESTION_CATEGORY_LABELS,
  getDailySetByStudyDay,
  getDailySetForDate,
  getQuestionById,
  getQuestionPairForDate,
  getSeoulDateKey,
} = (await import(questionBankSourcePath)) as typeof QuestionBankModule;

test("contains 120 complete lessons and 240 unique original questions", () => {
  assert.equal(QUESTION_CATEGORY_IDS.length, 15);
  assert.equal(DAILY_QUESTION_SETS.length, 120);
  assert.equal(QUESTION_BANK.length, 240);
  assert.equal(new Set(QUESTION_BANK.map((question) => question.id)).size, 240);
  assert.equal(new Set(QUESTION_BANK.map((question) => question.promptEn)).size, 240);

  for (const set of DAILY_QUESTION_SETS) {
    assert.equal(set.questions.length, 2);
    assert.equal(set.questions[0].slot, "familiar");
    assert.equal(set.questions[1].slot, "challenge");
    assert.equal(set.questions[0].category, set.category);
    assert.equal(set.questions[1].category, set.category);
  }
});

test("spreads the curriculum across materially different prompt and planning frames", () => {
  const framingCounts = new Map<string, number>();
  const planningCounts = new Map<string, number>();

  for (const question of QUESTION_BANK) {
    framingCounts.set(
      question.framingId,
      (framingCounts.get(question.framingId) ?? 0) + 1,
    );
    planningCounts.set(
      question.planningPatternId,
      (planningCounts.get(question.planningPatternId) ?? 0) + 1,
    );
  }

  // Sixteen functional lesson slots have five substantive variants each.
  assert.equal(framingCounts.size, 80);
  assert.equal(planningCounts.size, 80);
  assert.ok([...framingCounts.values()].every((count) => count === 3));
  assert.ok([...planningCounts.values()].every((count) => count === 3));

  const requiredMoveSets = new Set(
    QUESTION_BANK.map((question) => question.requiredMoves.join(" | ")),
  );
  const scaffoldSets = new Set(
    QUESTION_BANK.map((question) =>
      Object.values(question.koreanIdeaPrompts).join(" | "),
    ),
  );

  assert.equal(requiredMoveSets.size, 80);
  assert.ok(scaffoldSets.size >= 150);

  for (const category of QUESTION_CATEGORY_IDS) {
    const categoryQuestions = QUESTION_BANK.filter(
      (question) => question.category === category,
    );
    assert.equal(categoryQuestions.length, 16);
    assert.equal(
      new Set(categoryQuestions.map((question) => question.framingId)).size,
      16,
    );
    assert.equal(
      new Set(categoryQuestions.map((question) => question.planningPatternId))
        .size,
      16,
    );
  }
});

test("covers every category in all eight progressive cycles", () => {
  for (const category of QUESTION_CATEGORY_IDS) {
    const lessons = DAILY_QUESTION_SETS.filter((set) => set.category === category);
    assert.equal(lessons.length, 8);
    assert.deepEqual(
      lessons.map((set) => set.cycle).sort(),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.ok(QUESTION_CATEGORY_LABELS[category].length > 0);
  }

  assert.equal(
    QUESTION_BANK.filter((question) => question.type === "roleplay").length,
    30,
  );
  assert.ok(
    QUESTION_BANK.some(
      (question) => question.functions.includes("hypothesize"),
    ),
  );
  assert.ok(
    QUESTION_BANK.some((question) => question.functions.includes("predict")),
  );
});

test("includes Korean planning scaffolds and a copyright-safe source notice", () => {
  assert.match(QUESTION_BANK_SOURCE_LABEL, /공개된 OPIc 시험의 의사소통 기능/);
  assert.match(QUESTION_BANK_SOURCE_LABEL, /독창 문항/);
  assert.match(QUESTION_BANK_SOURCE_LABEL, /복제하거나 유출한 자료가 아닙니다/);
  assert.doesNotMatch(
    QUESTION_BANK_SOURCE_LABEL,
    /기출 그대로|기출 복원|유출(?:된)? 문항|100% 기출|verbatim|official past questions/i,
  );

  for (const question of QUESTION_BANK) {
    assert.equal(question.sourceLabel, QUESTION_BANK_SOURCE_LABEL);
    assert.doesNotMatch(
      question.promptEn,
      /\b(?:OPIc|ACTFL)\b|leaked question|official past question|verbatim/i,
    );
    assert.match(question.promptEn, /[.?!]$/);
    assert.equal(question.ttsText, question.promptEn);
    assert.match(question.framingId, /^c[1-8]-(?:familiar|challenge)-[a-z-]+-v[1-5]$/);
    assert.match(
      question.planningPatternId,
      /^c[1-8]-(?:familiar|challenge)-[a-z-]+-plan-v[1-5]$/,
    );
    assert.ok(question.requiredMoves.length >= 3);
    assert.ok(question.functions.length >= 2);
    assert.ok(question.koreanIdeaPrompts.answer.length > 10);
    assert.ok(question.koreanIdeaPrompts.reason.length > 10);
    assert.ok(question.koreanIdeaPrompts.example.length > 10);
    assert.ok(question.koreanIdeaPrompts.closing.length > 10);
    assert.equal(getQuestionById(question.id), question);
  }
});

test("keeps every spoken question clear and conversational", () => {
  const overlyAcademicWording = /\b(?:plateau|qualification|counterfactual|counterforce|accelerated|decision-makers|survival guide|responsible accelerator|secure a clear response)\b/i;
  const awkwardGeneratedPhrase = /about your plan to|wants to get better at (?:home|restaurants|shopping|movies|music|parks|travel|transportation|health|the environment)/i;

  for (const question of QUESTION_BANK) {
    const promptWords = question.promptEn.trim().split(/\s+/).filter(Boolean);
    const sentences = question.promptEn.split(/(?<=[.!?])\s+/);

    assert.doesNotMatch(question.promptEn, overlyAcademicWording);
    assert.doesNotMatch(question.promptEn, awkwardGeneratedPhrase);
    assert.ok(
      promptWords.length <= 60,
      `${question.id} is too long to follow comfortably when heard once`,
    );
    assert.ok(
      sentences.every(
        (sentence) => sentence.trim().split(/\s+/).filter(Boolean).length <= 26,
      ),
      `${question.id} contains a sentence that is too dense for spoken practice`,
    );
  }

  const revisedHomeQuestion = getQuestionById("home_neighborhood-cycle-5-familiar");
  assert.ok(revisedHomeQuestion);
  assert.equal(
    revisedHomeQuestion.promptEn,
    "Tell me about a time when you had trouble making your living space more comfortable. What problem kept happening? What small change did you make, and how did it help?",
  );
});

test("maps 120 consecutive calendar days deterministically without repeating a lesson", () => {
  assert.equal(getDailySetForDate(CURRICULUM_ANCHOR_DATE).sequence, 1);
  assert.equal(getDailySetForDate(CURRICULUM_ANCHOR_DATE).sequence, 1);

  const start = Date.UTC(2026, 0, 1);
  const ids = Array.from({ length: 120 }, (_, index) => {
    const key = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return getDailySetForDate(key).id;
  });

  assert.equal(new Set(ids).size, 120);
  assert.equal(getDailySetForDate("2026-05-01").id, ids[0]);
  assert.equal(getDailySetByStudyDay(121).id, getDailySetByStudyDay(1).id);
});

test("rotates only among selected survey categories and remains stable", () => {
  const selected = ["music_concerts", "travel_vacations", "not-a-category"];
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
  const pairs = dates.map((date) => getQuestionPairForDate(date, selected));

  for (const [index, pair] of pairs.entries()) {
    assert.deepEqual(pair, getQuestionPairForDate(dates[index], selected));
    assert.ok(["music_concerts", "travel_vacations"].includes(pair[0].category));
    assert.equal(pair[0].category, pair[1].category);
  }

  assert.notEqual(pairs[0][0].category, pairs[1][0].category);
  assert.equal(pairs[0][0].cycle, pairs[1][0].cycle);
  assert.notEqual(pairs[0][0].cycle, pairs[2][0].cycle);
});

test("uses Korea's calendar date around the UTC day boundary", () => {
  assert.equal(getSeoulDateKey(new Date("2026-07-14T15:30:00.000Z")), "2026-07-15");
  assert.equal(getSeoulDateKey(new Date("2026-07-15T14:59:59.000Z")), "2026-07-15");
  assert.throws(() => getDailySetForDate("2026-02-30"), /Invalid calendar date/);
  assert.throws(() => getDailySetByStudyDay(0), /positive integer/);
});
