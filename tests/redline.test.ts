import assert from "node:assert/strict";
import test from "node:test";
import { buildRedlineSegments } from "../app/lib/redline.ts";
import type { CoachIssue } from "../app/lib/types.ts";

function issue(
  id: string,
  original: string,
  suggestion: string,
  priority: 1 | 2 | 3,
  start?: number,
  end?: number,
): CoachIssue {
  return {
    id,
    source: "local_ai",
    category: "grammar",
    priority,
    original,
    suggestion,
    explanationKo: "교정 설명",
    start,
    end,
  };
}

test("keeps the original paragraph and inserts inline corrections in order", () => {
  const text = "I go there yesterday and it was very convenience.";
  const segments = buildRedlineSegments(text, [
    issue("two", "very convenience", "very convenient", 2),
    issue("one", "go there yesterday", "went there yesterday", 1),
  ]);

  assert.deepEqual(segments, [
    { kind: "plain", text: "I " },
    {
      kind: "change",
      issueId: "one",
      original: "go there yesterday",
      suggestion: "went there yesterday",
    },
    { kind: "plain", text: " and it was " },
    {
      kind: "change",
      issueId: "two",
      original: "very convenience",
      suggestion: "very convenient",
    },
    { kind: "plain", text: "." },
  ]);
});

test("uses exact offsets for repeated phrases", () => {
  const text = "It is good, but it is good for another reason.";
  const secondStart = text.lastIndexOf("it is good");
  const segments = buildRedlineSegments(text, [
    issue(
      "second",
      "it is good",
      "it works well",
      1,
      secondStart,
      secondStart + "it is good".length,
    ),
  ]);

  assert.equal(
    segments.find((segment) => segment.kind === "change")?.original,
    "it is good",
  );
  assert.equal(segments[0]?.kind === "plain" ? segments[0].text : "", "It is good, but ");
});

test("skips overlaps and suggestions that cannot be placed safely", () => {
  const text = "I like play golf.";
  const segments = buildRedlineSegments(text, [
    issue("wide", "like play golf", "like playing golf", 1),
    issue("overlap", "play golf", "playing golf", 2),
    issue("missing", "on weekends", "at weekends", 3),
  ]);

  assert.equal(segments.filter((segment) => segment.kind === "change").length, 1);
  assert.equal(
    segments.map((segment) => segment.kind === "plain" ? segment.text : segment.original).join(""),
    text,
  );
});

test("returns the untouched paragraph when there are no locatable issues", () => {
  assert.deepEqual(
    buildRedlineSegments("My answer is clear.", [
      issue("missing", "different sentence", "another sentence", 1),
    ]),
    [{ kind: "plain", text: "My answer is clear." }],
  );
});
