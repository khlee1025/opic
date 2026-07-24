import assert from "node:assert/strict";
import test from "node:test";

import { scoreResponse } from "../local-launcher/scoring.mjs";

const completePlan = {
  answer: "골프를 좋아한다.",
  reason: "스트레스를 풀 수 있기 때문이다.",
  example: "지난주 친구와 골프를 쳤다.",
  closing: "그래서 계속하고 싶다.",
};

const goldenSamples = {
  IM2: "I like golf. It is fun.",
  IH: [
    "I usually play golf on weekends.",
    "I like it because it helps me relax.",
    "For example, I played with my friend last week.",
    "We talked a lot and had fun.",
    "Overall, golf is my favorite hobby.",
  ].join(" "),
  AL: [
    "Actually, I started playing golf two years ago because I needed a hobby that could help me unwind.",
    "Although I was not very good at first, I have become much more comfortable on the course.",
    "For example, when I played with a friend last week, I stayed calm even though the weather was bad.",
    "However, I am still working on my swing, so every round gives me something specific to improve.",
    "As a result, golf has become more than a weekend activity for me.",
    "Overall, it is a hobby that keeps me focused while giving me a real break from work.",
  ].join(" "),
};

test("deterministic rubric returns the same result one hundred times", () => {
  const first = scoreResponse({
    rewriteDraft: goldenSamples.IH,
    koreanPlan: completePlan,
    localRuleViolations: [],
    targetLevel: "AL",
  });

  for (let index = 0; index < 100; index += 1) {
    assert.deepEqual(scoreResponse({
      rewriteDraft: goldenSamples.IH,
      koreanPlan: completePlan,
      localRuleViolations: [],
      targetLevel: "AL",
    }), first);
  }
  assert.ok(first.gapToTarget.length <= 2);
});

test("golden IM2, IH, and AL samples are separated into the expected bands", () => {
  for (const [band, rewriteDraft] of Object.entries(goldenSamples)) {
    const result = scoreResponse({
      rewriteDraft,
      koreanPlan: completePlan,
      localRuleViolations: [],
      targetLevel: "AL",
    });
    assert.equal(result.band, band);
  }
});

test("local-rule violations reduce accuracy without changing determinism", () => {
  const clean = scoreResponse({
    rewriteDraft: goldenSamples.IH,
    koreanPlan: completePlan,
    localRuleViolations: [],
    targetLevel: "IH",
  });
  const noisy = scoreResponse({
    rewriteDraft: goldenSamples.IH,
    koreanPlan: completePlan,
    localRuleViolations: ["went to home", "ate medicine", "took a rest"],
    targetLevel: "IH",
  });

  assert.ok(clean.subScores.accuracy > noisy.subScores.accuracy);
  assert.ok(noisy.gapToTarget.length <= 2);
});
