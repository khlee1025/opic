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
