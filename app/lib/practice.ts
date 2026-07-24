import type { PracticeStage } from "./types";

const PREVIOUS_STAGE: Readonly<Record<PracticeStage, PracticeStage | null>> = {
  not_started: null,
  question_seen: "not_started",
  korean_completed: "question_seen",
  draft_submitted: "korean_completed",
  feedback_ready: "korean_completed",
  rewrite_submitted: "korean_completed",
  completed: "korean_completed",
};

/** Returns the last editable screen while preserving everything already typed. */
export function getPreviousPracticeStage(
  stage: PracticeStage,
): PracticeStage | null {
  return PREVIOUS_STAGE[stage];
}

function comparablePhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function appliedCorrectionsForDraft(
  draft: string,
  issues: ReadonlyArray<{ original: string; suggestion: string }>,
): Array<{ from: string; to: string }> {
  const normalizedDraft = comparablePhrase(draft);
  return issues
    .filter((issue) => {
      const rejected = comparablePhrase(issue.original);
      const accepted = comparablePhrase(issue.suggestion);
      return rejected &&
        accepted &&
        normalizedDraft.includes(accepted) &&
        !normalizedDraft.includes(rejected);
    })
    .map((issue) => ({ from: issue.original, to: issue.suggestion }));
}
