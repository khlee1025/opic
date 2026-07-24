import assert from "node:assert/strict";
import test from "node:test";
import {
  appliedCorrectionsForDraft,
  getPreviousPracticeStage,
} from "../app/lib/practice.ts";

test("moves every practice stage back to the previous editable screen", () => {
  assert.equal(getPreviousPracticeStage("not_started"), null);
  assert.equal(getPreviousPracticeStage("question_seen"), "not_started");
  assert.equal(getPreviousPracticeStage("korean_completed"), "question_seen");
  assert.equal(getPreviousPracticeStage("draft_submitted"), "korean_completed");
  assert.equal(getPreviousPracticeStage("feedback_ready"), "korean_completed");
  assert.equal(getPreviousPracticeStage("rewrite_submitted"), "korean_completed");
  assert.equal(getPreviousPracticeStage("completed"), "korean_completed");
});

test("only corrections actually present in the current draft are resent", () => {
  const issues = [
    {
      original: "I had a promise with my friend",
      suggestion: "I had plans with my friend",
    },
    {
      original: "we played exercise",
      suggestion: "we worked out",
    },
  ];

  assert.deepEqual(
    appliedCorrectionsForDraft(
      "I had a promise with my friend, and we played exercise.",
      issues,
    ),
    [],
  );
  assert.deepEqual(
    appliedCorrectionsForDraft(
      "I had plans with my friend, and we worked out.",
      issues,
    ),
    [
      {
        from: "I had a promise with my friend",
        to: "I had plans with my friend",
      },
      {
        from: "we played exercise",
        to: "we worked out",
      },
    ],
  );
});
