export const DAILY_QUESTION_GOAL = 2 as const;
export const COACH_STATE_VERSION = 1 as const;

export type TargetLevel = "IH" | "AL";

export type QuestionType =
  | "description"
  | "experience"
  | "comparison"
  | "change"
  | "roleplay"
  | "problem"
  | "opinion";

export type QuestionDifficulty = 1 | 2 | 3;

export interface DailyQuestion {
  id: string;
  topic: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  promptEn: string;
  ttsText?: string;
  requiredMoves: string[];
  koreanIdeaPrompts: string[];
  baseModelAnswer?: string;
  stretchModelAnswer?: string;
  recurrenceKey: string;
}

export interface KoreanPlan {
  answer: string;
  reason: string;
  example: string;
  closing: string;
}

export type KoreanIdeaPlan = KoreanPlan;

export type PracticeStage =
  | "not_started"
  | "question_seen"
  | "korean_completed"
  | "draft_submitted"
  | "feedback_ready"
  | "rewrite_submitted"
  | "completed";

export type IssueCategory =
  | "meaning"
  | "grammar"
  | "word_choice"
  | "naturalness";

export interface CoachIssue {
  id: string;
  source: "rule" | "local_ai";
  category: IssueCategory;
  priority: 1 | 2 | 3;
  original: string;
  suggestion: string;
  explanationKo: string;
  start?: number;
  end?: number;
  ruleId?: string;
}

export interface IntentCoverage {
  answer: boolean;
  reason: boolean;
  example: boolean;
  closing: boolean;
}

export interface PhraseUpgrade {
  from: string;
  to: string;
  whyKo: string;
}

export interface RubricScore {
  band: "IM2" | "IH" | "AL";
  totalScore: number;
  targetLevel: TargetLevel;
  subScores: {
    coverage: number;
    structure: number;
    complexity: number;
    tenseControl: number;
    vocabulary: number;
    accuracy: number;
  };
  metrics: {
    coverageCount: number;
    sentenceCount: number;
    subordinateClauseCount: number;
    connectorDiversity: number;
    tenseDiversity: number;
    typeTokenRatio: number;
    localRuleViolationCount: number;
  };
  gapToTarget: string[];
}

export interface CoachFeedback {
  source?: "local-model" | "rules-only";
  modelUsed?: string | null;
  diagnosisKo: string;
  intentCoverage: IntentCoverage;
  issues: CoachIssue[];
  rewriteTargets: string[];
  correctedEnglish?: string;
  naturalEnglish?: string;
  modelAnswer?: string;
  stretchAnswer?: string;
  phraseUpgrades?: PhraseUpgrade[];
  nextTaskKo?: string;
  score?: RubricScore;
}

export interface QuestionAttempt {
  questionId: string;
  stage: PracticeStage;
  koreanPlan: KoreanPlan;
  englishDraft: string;
  englishRewrite: string;
  feedback?: CoachFeedback;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DailyPractice {
  dateKey: string;
  questionIds: string[];
  attempts: Record<string, QuestionAttempt>;
}

export interface CoachProfile {
  selectedInterestIds: string[];
  surveyAnswers: Record<string, string | string[]>;
}

export interface CoachSettings {
  targetLevel: TargetLevel;
  dailyGoal: typeof DAILY_QUESTION_GOAL;
}

export interface CoachState {
  version: typeof COACH_STATE_VERSION;
  profile: CoachProfile;
  settings: CoachSettings;
  days: Record<string, DailyPractice>;
  createdAt: string;
  updatedAt: string;
}

export interface CoachExportEnvelope {
  app: "opic-daily-coach";
  exportedAt: string;
  data: CoachState;
}
