import type { CoachIssue } from "./types";

export type RedlineSegment =
  | {
      kind: "plain";
      text: string;
    }
  | {
      kind: "change";
      issueId: string;
      original: string;
      suggestion: string;
    };

interface LocatedChange {
  start: number;
  end: number;
  issue: CoachIssue;
}

function comparable(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

function overlaps(
  start: number,
  end: number,
  changes: LocatedChange[],
) {
  return changes.some((change) => start < change.end && end > change.start);
}

function locateIssue(
  text: string,
  issue: CoachIssue,
  changes: LocatedChange[],
): LocatedChange | null {
  const original = issue.original.trim();
  const suggestion = issue.suggestion.trim();
  if (!original || !suggestion || comparable(original) === comparable(suggestion)) {
    return null;
  }

  if (
    Number.isInteger(issue.start) &&
    Number.isInteger(issue.end) &&
    Number(issue.start) >= 0 &&
    Number(issue.end) <= text.length &&
    Number(issue.end) > Number(issue.start)
  ) {
    const start = Number(issue.start);
    const end = Number(issue.end);
    if (
      comparable(text.slice(start, end)) === comparable(original) &&
      !overlaps(start, end, changes)
    ) {
      return { start, end, issue };
    }
  }

  const haystack = comparable(text);
  const needle = comparable(original);
  let fromIndex = 0;
  while (fromIndex < haystack.length) {
    const start = haystack.indexOf(needle, fromIndex);
    if (start < 0) return null;
    const end = start + original.length;
    if (!overlaps(start, end, changes)) return { start, end, issue };
    fromIndex = start + 1;
  }
  return null;
}

/**
 * Turns the learner's exact paragraph into safe, non-overlapping redline
 * segments. Unmatched model suggestions stay in the explanation cards instead
 * of being inserted at an unreliable position.
 */
export function buildRedlineSegments(
  text: string,
  issues: CoachIssue[],
): RedlineSegment[] {
  if (!text) return [];

  const changes: LocatedChange[] = [];
  for (const issue of [...issues].sort((a, b) => a.priority - b.priority)) {
    const located = locateIssue(text, issue, changes);
    if (located) changes.push(located);
  }
  changes.sort((a, b) => a.start - b.start);

  if (!changes.length) return [{ kind: "plain", text }];

  const segments: RedlineSegment[] = [];
  let cursor = 0;
  for (const change of changes) {
    if (change.start > cursor) {
      segments.push({ kind: "plain", text: text.slice(cursor, change.start) });
    }
    segments.push({
      kind: "change",
      issueId: change.issue.id,
      original: text.slice(change.start, change.end),
      suggestion: change.issue.suggestion.trim(),
    });
    cursor = change.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "plain", text: text.slice(cursor) });
  }
  return segments;
}
