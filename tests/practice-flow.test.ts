import assert from "node:assert/strict";
import test from "node:test";
import { getPreviousPracticeStage } from "../app/lib/practice.ts";

test("moves every practice stage back to the previous editable screen", () => {
  assert.equal(getPreviousPracticeStage("not_started"), null);
  assert.equal(getPreviousPracticeStage("question_seen"), "not_started");
  assert.equal(getPreviousPracticeStage("korean_completed"), "question_seen");
  assert.equal(getPreviousPracticeStage("draft_submitted"), "korean_completed");
  assert.equal(getPreviousPracticeStage("feedback_ready"), "korean_completed");
  assert.equal(getPreviousPracticeStage("rewrite_submitted"), "korean_completed");
  assert.equal(getPreviousPracticeStage("completed"), "korean_completed");
});
